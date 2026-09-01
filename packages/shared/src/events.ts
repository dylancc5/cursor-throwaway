import type { BurnConfig } from "./api.js";
import type { TokenUsage } from "./types.js";

export type BurnEvent =
  | { type: "session.started"; sessionId: string; config: BurnConfig; at: string }
  | {
      type: "session.stopped";
      reason: "cap_reached" | "user" | "error";
      at: string;
    }
  | { type: "auth.ok"; email?: string }
  | { type: "agent.spawned"; agentId: string; workerId: number }
  | { type: "agent.recycled"; agentId: string; turnsCompleted: number }
  | { type: "run.started"; agentId: string; runId: string; model: string }
  | {
      type: "run.completed";
      agentId: string;
      runId: string;
      usage: TokenUsage;
      durationMs: number;
    }
  | {
      type: "usage.snapshot";
      session: {
        tokens: number;
        costCents: number;
        tokensPerSec: number;
      };
      account?: {
        totalPercent: number;
        autoPercent: number;
        apiPercent: number;
        includedSpendCents: number;
        limitCents: number;
      };
      cap: {
        type: string;
        target: number;
        current: number;
        remaining: number;
      };
      activeAgents: number;
      at: string;
    }
  | {
      type: "concurrency.adjusted";
      from: number;
      to: number;
      reason: string;
    }
  | { type: "rate_limit"; retryInMs: number; concurrency: number }
  | { type: "error"; message: string; recoverable: boolean };

export function isBurnEvent(value: unknown): value is BurnEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as BurnEvent).type === "string"
  );
}
