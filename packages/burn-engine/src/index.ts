/**
 * Track 2 — Burn Engine.
 *
 * Public surface consumed by Track 3's API routes. Nothing here imports a
 * vendor SDK or any HTTP machinery; swap the `AgentBackend` implementation to
 * change what actually executes runs.
 */
export { BurnOrchestrator, type OrchestratorOptions } from "./orchestrator.ts";
export { PoolManager, type PoolManagerOptions } from "./pool-manager.ts";
export { AgentWorker, type WorkerContext } from "./agent-worker.ts";
export { ConcurrencyController, type ConcurrencyControllerOptions, type ConcurrencyChange } from "./concurrency.ts";
export { UsageAggregator, type UsageAggregatorOptions } from "./usage-aggregator.ts";
export { BurnStrategy } from "./strategy.ts";
export {
  QueueTaskSource,
  SyntheticTaskSource,
  type Task,
  type TaskSource,
} from "./task-source.ts";
export {
  RateLimitError,
  type AgentBackend,
  type AgentHandle,
  type CreateAgentOptions,
  type ModelInfo,
  type RunRequest,
  type RunResult,
} from "./backend.ts";
export {
  SimulatedBackend,
  type SimulatedBackendOptions,
  type RateLimitWindow,
} from "./simulated-backend.ts";

// Re-exported from the local contract mirrors; these become re-exports of
// `@cursor-throwaway/shared` once Track 3 lands that package.
export type * from "./types.ts";
export type * from "./events.ts";
