import type { BurnConfig, BurnSessionStatus } from "@cursor-burner/shared";
import { decryptApiKey, encryptApiKey } from "./crypto.js";

const AUTH_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionRecord {
  sessionId: string;
  status: BurnSessionStatus;
  email?: string;
  apiKeyEncrypted?: string;
  loginUrl?: string;
  authPending: boolean;
  config?: BurnConfig;
  createdAt: number;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly sessionSecret: string) {}

  createPendingAuth(sessionId: string): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      sessionId,
      status: "authenticating",
      authPending: true,
      createdAt: now,
      expiresAt: now + AUTH_TTL_MS,
    };
    this.sessions.set(sessionId, record);
    return record;
  }

  setLoginUrl(sessionId: string, loginUrl: string): void {
    const record = this.require(sessionId);
    record.loginUrl = loginUrl;
  }

  completeAuth(
    sessionId: string,
    apiKey: string,
    email?: string,
  ): SessionRecord {
    const record = this.require(sessionId);
    record.status = "idle";
    record.authPending = false;
    record.email = email;
    record.apiKeyEncrypted = encryptApiKey(
      apiKey,
      this.sessionSecret,
      sessionId,
    );
    record.expiresAt = Date.now() + SESSION_TTL_MS;
    record.loginUrl = undefined;
    return record;
  }

  failAuth(sessionId: string, message: string): void {
    const record = this.require(sessionId);
    record.status = "error";
    record.authPending = false;
    record.loginUrl = undefined;
    void message;
  }

  get(sessionId: string): SessionRecord | undefined {
    const record = this.sessions.get(sessionId);
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return record;
  }

  getApiKey(sessionId: string): string | undefined {
    const record = this.get(sessionId);
    if (!record?.apiKeyEncrypted) return undefined;
    return decryptApiKey(record.apiKeyEncrypted, this.sessionSecret);
  }

  setBurnConfig(sessionId: string, config: BurnConfig): void {
    const record = this.require(sessionId);
    record.config = config;
  }

  setStatus(sessionId: string, status: BurnSessionStatus): void {
    const record = this.require(sessionId);
    record.status = status;
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [id, record] of this.sessions) {
      if (now > record.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  private require(sessionId: string): SessionRecord {
    const record = this.get(sessionId);
    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return record;
  }
}
