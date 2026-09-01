import type { BurnConfig } from "./api.js";
import type { AccountUsage, CapProgress, SessionUsage, TokenUsage } from "./types.js";

export type BurnEvent =
  | { type: "session.started"; sessionId: string; config: BurnConfig; at: string }
  | {
      type: "session.stopped";
      sessionId?: string;
      reason: "cap_reached" | "user" | "error";
      at: string;
    }
  | { type: "session.paused"; sessionId?: string; at: string }
  | { type: "session.resumed"; sessionId?: string; at: string }
  | { type: "auth.ok"; email?: string; sessionId?: string; at?: string }
  | {
      type: "agent.spawned";
      agentId: string;
      workerId: number;
      model?: string;
      at: string;
    }
  | {
      type: "agent.recycled";
      agentId: string;
      workerId?: number;
      turnsCompleted: number;
      at: string;
    }
  | {
      type: "run.started";
      agentId: string;
      workerId?: number;
      runId: string;
      model: string;
      at: string;
    }
  | {
      type: "run.completed";
      agentId: string;
      workerId?: number;
      runId: string;
      usage: TokenUsage;
      durationMs: number;
      at: string;
    }
  | {
      type: "usage.snapshot";
      sessionId?: string;
      session: SessionUsage;
      account?: AccountUsage;
      cap: CapProgress;
      activeAgents: number;
      at: string;
    }
  | {
      type: "concurrency.adjusted";
      from: number;
      to: number;
      reason: string;
      at?: string;
    }
  | { type: "rate_limit"; retryInMs: number; concurrency: number; at?: string }
  | { type: "error"; message: string; recoverable: boolean; at?: string };

export function isBurnEvent(value: unknown): value is BurnEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as BurnEvent).type === "string"
  );
}
