export type CapType = 'percent' | 'dollars' | 'session_tokens';

export type ModelPreference = 'fastest_pool' | 'cursor_models' | 'other_models';

export interface BurnCapConfig {
  type: CapType;
  value: number;
}

export interface BurnConfig {
  cap: BurnCapConfig;
  modelPreference: ModelPreference;
  initialConcurrency?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  costCents?: number;
}

export type BurnSessionStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error';

export interface AccountUsage {
  totalPercent: number;
  autoPercent: number;
  apiPercent: number;
  includedSpendCents: number;
  limitCents: number;
}

export interface CapStatus {
  type: CapType | string;
  target: number;
  current: number;
  remaining: number;
}

export interface SessionUsage {
  tokens: number;
  costCents: number;
  tokensPerSec: number;
}

export interface BurnSnapshot {
  sessionId: string;
  status: BurnSessionStatus;
  session: SessionUsage;
  account?: AccountUsage;
  cap: CapStatus;
  activeAgents: number;
  targetConcurrency: number;
  at: string;
}

export type AgentStatus = 'idle' | 'spawning' | 'working' | 'recycled' | 'error';

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

export interface AuthSession {
  sessionId: string;
  status: 'pending' | 'logged-in' | 'expired' | 'error';
  email?: string;
  expiresAt?: string;
  errorMessage?: string;
}
