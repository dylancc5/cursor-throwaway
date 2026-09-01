import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { SdkLoginBridge } from "./auth/sdk-login-bridge.js";
import { BurnController } from "./burn-controller.js";
import { createAuthRouter } from "./routes/auth.js";
import { createBurnRouter } from "./routes/burn.js";
import { createSseRouter } from "./routes/sse.js";
import { EventHub } from "./sse/event-hub.js";
import { SessionStore } from "./session-store.js";

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-secret-change-in-production-32chars";

const sessionStore = new SessionStore(SESSION_SECRET);
const eventHub = new EventHub();
const loginBridge = new SdkLoginBridge(sessionStore);
const burnController = new BurnController(sessionStore, eventHub);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", createAuthRouter(sessionStore, loginBridge));
app.route("/burn", createBurnRouter(burnController, sessionStore));
app.route("/burn", createSseRouter(eventHub, sessionStore));

setInterval(() => sessionStore.cleanupExpired(), 60_000);

console.log(`API listening on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });

export { app, burnController, sessionStore, eventHub };
