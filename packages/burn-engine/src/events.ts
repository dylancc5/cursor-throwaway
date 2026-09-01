/**
 * LOCAL MIRROR of `packages/shared/src/events.ts` (DESIGN.md §7.1).
 * See the note at the top of `types.ts` — delete this at Track 3 integration.
 *
 * The union below is the exact wire contract Track 1's dashboard renders and
 * Track 3's SSE hub fans out, so field names must not drift.
 */
import type {
  AccountUsage,
  BurnConfig,
  CapState,
  SessionTotals,
  StopReason,
  TokenUsage,
} from "./types.ts";

export type BurnEvent =
  | { type: "session.started"; sessionId: string; config: BurnConfig; at: string }
  | { type: "session.stopped"; reason: StopReason; at: string }
  | { type: "session.paused"; at: string }
  | { type: "session.resumed"; at: string }
  | { type: "auth.ok"; email?: string }
  | { type: "agent.spawned"; agentId: string; workerId: number; at: string }
  | { type: "agent.recycled"; agentId: string; turnsCompleted: number; at: string }
  | { type: "run.started"; agentId: string; runId: string; model: string; at: string }
  | {
      type: "run.completed";
      agentId: string;
      runId: string;
      usage: TokenUsage;
      durationMs: number;
      at: string;
    }
  | {
      type: "usage.snapshot";
      session: SessionTotals;
      account?: AccountUsage;
      cap: CapState;
      activeAgents: number;
      at: string;
    }
  | { type: "concurrency.adjusted"; from: number; to: number; reason: string; at: string }
  | { type: "rate_limit"; retryInMs: number; concurrency: number; at: string }
  | { type: "error"; message: string; recoverable: boolean; at: string };

export type BurnEventHandler = (event: BurnEvent) => void;
