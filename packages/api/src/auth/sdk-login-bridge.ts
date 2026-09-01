import { Cursor, InMemoryCredentialStore } from "@cursor/sdk";
import type { SessionStore } from "../session-store.js";

export interface LoginStartResult {
  sessionId: string;
  loginUrl: string;
}

export class SdkLoginBridge {
  private readonly pending = new Map<
    string,
    { store: InMemoryCredentialStore; abort: AbortController }
  >();

  constructor(private readonly sessionStore: SessionStore) {}

  async startLogin(sessionId: string): Promise<LoginStartResult> {
    const store = new InMemoryCredentialStore();
    const abort = new AbortController();
    this.pending.set(sessionId, { store, abort });
    this.sessionStore.createPendingAuth(sessionId);

    const loginPromise = Cursor.auth.login({
      store,
      openBrowser: false,
      signal: abort.signal,
      onLoginUrl: (url) => {
        this.sessionStore.setLoginUrl(sessionId, url);
      },
      apiKeyName: `cursor-burner-${sessionId.slice(0, 8)}`,
    });

    void loginPromise
      .then(async (result) => {
        const me = await Cursor.me({ apiKey: result.apiKey });
        this.sessionStore.completeAuth(
          sessionId,
          result.apiKey,
          me.userEmail ?? result.email,
        );
        this.pending.delete(sessionId);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Login failed";
        this.sessionStore.failAuth(sessionId, message);
        this.pending.delete(sessionId);
      });

    await waitForLoginUrl(sessionId, this.sessionStore, 15_000);

    const record = this.sessionStore.get(sessionId);
    if (!record?.loginUrl) {
      throw new Error("Failed to obtain Cursor login URL");
    }

    return { sessionId, loginUrl: record.loginUrl };
  }

  cancelLogin(sessionId: string): void {
    const pending = this.pending.get(sessionId);
    if (pending) {
      pending.abort.abort();
      this.pending.delete(sessionId);
    }
  }
}

async function waitForLoginUrl(
  sessionId: string,
  store: SessionStore,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const record = store.get(sessionId);
    if (record?.loginUrl) return;
    if (record?.status === "idle" || record?.status === "error") return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for login URL");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
