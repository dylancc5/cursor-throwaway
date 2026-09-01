/**
 * LOCAL MIRROR of `packages/shared/src/types.ts` (DESIGN.md §5, Track 3).
 *
 * Track 3 owns these contracts and had not landed `packages/shared` when this
 * package was written. At integration: delete this file and re-point the
 * imports in `index.ts` at `@cursor-throwaway/shared`. The shapes below are
 * copied from DESIGN.md §7.1 and §8 verbatim so that swap is mechanical.
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** Provider-reported charge for the run, in cents. */
  chargedCents: number;
}

export type CapType = "percent" | "dollars" | "session_tokens";

export interface BurnConfig {
  cap: {
    type: CapType;
    /** 95 (%), 15 ($), 10_000_000 (tokens) — units follow `type`. */
    value: number;
  };
  modelPreference: "fastest_pool" | "cursor_models" | "other_models";
  /** DESIGN.md §6.1 defaults; overridable for tuning runs. */
  initialConcurrency?: number;
  minConcurrency?: number;
  maxConcurrency?: number;
  /** Turns before a worker recycles its agent (DESIGN.md §6.4 step 5). */
  turnsPerAgent?: number;
  /** Follow-ups sent per initial task (DESIGN.md §6.4 step 4). */
  followUpsPerTask?: number;
}

export interface AccountUsage {
  totalPercent: number;
  autoPercent: number;
  apiPercent: number;
  includedSpendCents: number;
  limitCents: number;
}

export interface CapState {
  type: CapType;
  target: number;
  current: number;
  remaining: number;
  /** True once `current >= target`; the orchestrator halts on this edge. */
  reached: boolean;
}

export interface SessionTotals {
  tokens: number;
  costCents: number;
  tokensPerSec: number;
}

export type AgentPhase = "spawning" | "running" | "idle" | "recycling" | "stopped";

export interface AgentState {
  agentId: string;
  workerId: number;
  phase: AgentPhase;
  model: string;
  turnsCompleted: number;
  tokens: number;
}

export type SessionStatus = "idle" | "running" | "paused" | "stopping" | "stopped";

export interface BurnSnapshot {
  sessionId: string;
  status: SessionStatus;
  session: SessionTotals;
  account?: AccountUsage;
  cap: CapState;
  activeAgents: number;
  targetConcurrency: number;
  agents: AgentState[];
  startedAt?: string;
  at: string;
}

export type StopReason = "cap_reached" | "user" | "error";
