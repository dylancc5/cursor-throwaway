import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { SdkLoginBridge } from "../auth/sdk-login-bridge.js";
import type { SessionStore } from "../session-store.js";

export function createAuthRouter(
  sessionStore: SessionStore,
  loginBridge: SdkLoginBridge,
) {
  const app = new Hono();

  app.post("/login", async (c) => {
    const sessionId = randomUUID();
    try {
      const result = await loginBridge.startLogin(sessionId);
      c.header(
        "Set-Cookie",
        `burn_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict`,
      );
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      return c.json({ error: message }, 500);
    }
  });

  app.get("/status/:sessionId", (c) => {
    const sessionId = c.req.param("sessionId");
    const record = sessionStore.get(sessionId);
    if (!record) {
      return c.json({ status: "expired" as const });
    }
    if (record.status === "error") {
      return c.json({ status: "error" as const, message: "Authentication failed" });
    }
    if (record.authPending) {
      return c.json({ status: "pending" as const });
    }
    if (record.apiKeyEncrypted) {
      return c.json({
        status: "logged-in" as const,
        email: record.email,
        sessionId,
      });
    }
    return c.json({ status: "pending" as const });
  });

  app.post("/logout", (c) => {
    const sessionId = getSessionIdFromCookie(c.req.header("Cookie"));
    if (sessionId) {
      loginBridge.cancelLogin(sessionId);
      sessionStore.clear(sessionId);
    }
    c.header(
      "Set-Cookie",
      "burn_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    );
    return c.json({ ok: true });
  });

  return app;
}

function getSessionIdFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)burn_session=([^;]+)/);
  return match?.[1];
}
