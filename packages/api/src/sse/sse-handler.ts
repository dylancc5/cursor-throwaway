import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { EventHub } from "./event-hub.js";

export function createSseHandler(eventHub: EventHub) {
  return async (c: Context) => {
    const sessionId = c.get("sessionId") as string | undefined;
    if (!sessionId) {
      return c.json({ error: "Missing session" }, 401);
    }

    return streamSSE(c, async (stream) => {
      const unsubscribe = eventHub.subscribe(sessionId, (event) => {
        void stream.writeSSE({
          event: "burn",
          data: JSON.stringify(event),
        });
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "ping", data: "" });
      }, 15_000);

      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      await new Promise<void>(() => {
        // Keep connection open until client disconnects.
      });
    });
  };
}
