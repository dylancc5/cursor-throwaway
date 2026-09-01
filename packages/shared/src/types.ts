import type { BurnConfig } from "./api.js";

export type BurnSessionStatus =
  | "authenticating"
  | "idle"
  | "burning"
  | "paused"
  | "stopped"
  | "error";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface BurnSession {
  sessionId: string;
  status: BurnSessionStatus;
  email?: string;
  config?: BurnConfig;
  createdAt: string;
  updatedAt: string;
}

export interface BurnSnapshot {
  sessionId: string;
  status: BurnSessionStatus;
  config?: BurnConfig;
  session: {
    tokens: number;
    costCents: number;
    tokensPerSec: number;
    activeAgents: number;
    completedRuns: number;
  };
  account?: AccountUsage;
  cap?: CapProgress;
  concurrency: number;
}

export interface AccountUsage {
  totalPercent: number;
  autoPercent: number;
  apiPercent: number;
  includedSpendCents: number;
  limitCents: number;
}

export interface CapProgress {
  type: "percent" | "dollars" | "session_tokens";
  target: number;
  current: number;
  remaining: number;
}

export interface SessionMetrics {
  tokens: number;
  costCents: number;
}

export interface BurnEngine {
  start(
    apiKey: string,
    sessionId: string,
    config: BurnConfig,
    onEvent: (event: import("./events.js").BurnEvent) => void,
  ): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  getSnapshot(): BurnSnapshot;
  isRunning(): boolean;
}
