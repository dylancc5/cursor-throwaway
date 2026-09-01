import type { BurnConfig, CapType, ModelPreference } from "./api.js";

export type { CapType, ModelPreference };

export interface BurnCapConfig {
  type: CapType;
  value: number;
}

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

export interface AccountUsage {
  totalPercent: number;
  autoPercent: number;
  apiPercent: number;
  includedSpendCents: number;
  limitCents: number;
}

export interface CapProgress {
  type: CapType | string;
  target: number;
  current: number;
  remaining: number;
}

export type CapStatus = CapProgress;

export interface SessionUsage {
  tokens: number;
  costCents: number;
  tokensPerSec: number;
}

export interface SessionMetrics {
  tokens: number;
  costCents: number;
}

export interface BurnSnapshot {
  sessionId: string;
  status: BurnSessionStatus;
  config?: BurnConfig;
  session: SessionUsage;
  account?: AccountUsage;
  cap: CapProgress;
  activeAgents: number;
  targetConcurrency: number;
  at: string;
  accountUsageAvailable?: boolean;
}

export type AgentStatus = "idle" | "spawning" | "working" | "recycled" | "error";

export interface AgentWorkerState {
  workerId: number;
  agentId: string;
  status: AgentStatus;
  model: string;
  turnsCompleted: number;
  totalTokens: number;
  lastActiveAt: string;
  currentRunId?: string;
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
