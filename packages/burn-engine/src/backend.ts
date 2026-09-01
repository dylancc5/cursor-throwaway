/**
 * The single seam between the orchestration machinery and whatever is actually
 * executing runs. Everything above this file (pool, workers, concurrency,
 * aggregation, orchestrator) is backend-agnostic and never imports a vendor SDK.
 *
 * `SimulatedBackend` is the implementation shipped with this package.
 */
import type { AccountUsage, TokenUsage } from "./types.ts";

export interface ModelInfo {
  id: string;
  /** Which quota pool the model draws from — drives strategy ranking (§6.3). */
  pool: "cursor_models" | "other_models";
  /** Relative cost weight; higher depletes its pool faster per token. */
  costWeight: number;
  supportsFast: boolean;
}

export interface AgentHandle {
  id: string;
  model: string;
}

export interface CreateAgentOptions {
  model: string;
  metadata: Record<string, string>;
  signal?: AbortSignal;
}

export interface RunRequest {
  agent: AgentHandle;
  /** Opaque task payload handed to the backend. */
  input: string;
  signal?: AbortSignal;
}

export interface RunResult {
  runId: string;
  usage: TokenUsage;
  durationMs: number;
  model: string;
}

/** Thrown by a backend when the provider returns 429. */
export class RateLimitError extends Error {
  readonly retryInMs: number;
  constructor(retryInMs: number, message = "rate limited") {
    super(message);
    this.name = "RateLimitError";
    this.retryInMs = retryInMs;
  }
}

export interface AgentBackend {
  listModels(): Promise<ModelInfo[]>;
  createAgent(options: CreateAgentOptions): Promise<AgentHandle>;
  run(request: RunRequest): Promise<RunResult>;
  deleteAgent(agent: AgentHandle): Promise<void>;
  /** Optional account-level usage; absent backends fall back to session metrics. */
  getAccountUsage?(): Promise<AccountUsage>;
}
