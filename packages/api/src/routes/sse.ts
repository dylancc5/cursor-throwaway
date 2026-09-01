import { Hono } from "hono";
import { createSseHandler } from "../sse/sse-handler.js";
import type { EventHub } from "../sse/event-hub.js";
import type { SessionStore } from "../session-store.js";

export function createSseRouter(eventHub: EventHub, sessionStore: SessionStore) {
  const app = new Hono();
  const handler = createSseHandler(eventHub);

  app.get("/events", async (c) => {
    const sessionId = getSessionIdFromCookie(c.req.header("Cookie"));
    if (!sessionId || !sessionStore.get(sessionId)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("sessionId", sessionId);
    return handler(c);
  });

  return app;
}

function getSessionIdFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)burn_session=([^;]+)/);
  return match?.[1];
}
