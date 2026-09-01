import { Hono } from "hono";
import { BurnStartRequestSchema } from "@cursor-burner/shared";
import type { BurnController } from "../burn-controller.js";
import type { SessionStore } from "../session-store.js";

declare module "hono" {
  interface ContextVariableMap {
    sessionId: string;
  }
}

export function createBurnRouter(
  burnController: BurnController,
  sessionStore: SessionStore,
) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const sessionId = getSessionIdFromCookie(c.req.header("Cookie"));
    if (!sessionId || !sessionStore.get(sessionId)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("sessionId", sessionId);
    await next();
  });

  app.post("/start", async (c) => {
    const sessionId = c.get("sessionId");
    const body = await c.req.json();
    const parsed = BurnStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      await burnController.start(sessionId, parsed.data);
      return c.json({ ok: true, accountUsageAvailable: burnController.isAccountUsageAvailable() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start burn";
      return c.json({ error: message }, 500);
    }
  });

  app.post("/stop", async (c) => {
    const sessionId = c.get("sessionId");
    await burnController.stop(sessionId);
    return c.json({ ok: true });
  });

  app.post("/pause", (c) => {
    burnController.pause();
    return c.json({ ok: true });
  });

  app.post("/resume", (c) => {
    burnController.resume();
    return c.json({ ok: true });
  });

  app.get("/status", (c) => {
    const sessionId = c.get("sessionId");
    return c.json(burnController.getStatus(sessionId));
  });

  return app;
}

function getSessionIdFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)burn_session=([^;]+)/);
  return match?.[1];
}
