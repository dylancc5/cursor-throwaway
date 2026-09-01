/**
 * Deterministic stand-in for a cloud agent provider.
 *
 * Everything a demo needs to be interesting — run latency spread, token
 * accrual, rate-limit storms, account-level quota movement — is generated
 * here from a seeded PRNG, so a given seed replays the same session every
 * time. That is the property you want on stage: the 429 spike lands where
 * you said it would, and the cap trips on cue.
 */
import {
  RateLimitError,
  type AgentBackend,
  type AgentHandle,
  type CreateAgentOptions,
  type ModelInfo,
  type RunRequest,
  type RunResult,
} from "./backend.ts";
import type { AccountUsage } from "./types.ts";

/** mulberry32 — small, fast, and reproducible across Node versions. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A window of forced 429s, expressed in seconds since session start. */
export interface RateLimitWindow {
  startSec: number;
  endSec: number;
  /** Fraction of requests rejected inside the window (0–1). */
  intensity: number;
  retryInMs?: number;
}

export interface SimulatedBackendOptions {
  seed?: number;
  models?: ModelInfo[];
  /** Mean wall-clock duration of one run. */
  meanRunMs?: number;
  runMsJitter?: number;
  /** Output tokens produced per run, before jitter. */
  meanOutputTokens?: number;
  /** Concurrency above which the backend starts self-throttling. */
  softConcurrencyLimit?: number;
  rateLimitWindows?: RateLimitWindow[];
  accountLimitCents?: number;
  /** Injected clock + sleep so tests can run without real time passing. */
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_MODELS: ModelInfo[] = [
  { id: "sim-opus-class", pool: "other_models", costWeight: 5.0, supportsFast: false },
  { id: "sim-composer-2.5", pool: "cursor_models", costWeight: 1.0, supportsFast: true },
  { id: "sim-auto-smart", pool: "cursor_models", costWeight: 1.6, supportsFast: true },
];

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class SimulatedBackend implements AgentBackend {
  readonly #rng: () => number;
  readonly #models: ModelInfo[];
  readonly #opts: Required<
    Omit<SimulatedBackendOptions, "seed" | "models" | "rateLimitWindows" | "now" | "sleep">
  >;
  readonly #windows: RateLimitWindow[];
  readonly #now: () => number;
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  #startedAt: number;
  #inFlight = 0;
  #agentSeq = 0;
  #runSeq = 0;
  #spentCents = 0;
  #autoSpentCents = 0;
  #apiSpentCents = 0;

  /** Counters the demo and tests assert against. */
  readonly stats = { runsStarted: 0, runsCompleted: 0, rateLimited: 0, agentsCreated: 0, agentsDeleted: 0 };

  constructor(options: SimulatedBackendOptions = {}) {
    this.#rng = makeRng(options.seed ?? 1);
    this.#models = options.models ?? DEFAULT_MODELS;
    this.#windows = options.rateLimitWindows ?? [];
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#startedAt = this.#now();
    this.#opts = {
      meanRunMs: options.meanRunMs ?? 1400,
      runMsJitter: options.runMsJitter ?? 700,
      meanOutputTokens: options.meanOutputTokens ?? 9000,
      softConcurrencyLimit: options.softConcurrencyLimit ?? 24,
      accountLimitCents: options.accountLimitCents ?? 2000,
    };
  }

  /** Re-anchors the clock so rate-limit windows are relative to session start. */
  resetClock(): void {
    this.#startedAt = this.#now();
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.#models.slice();
  }

  async createAgent(options: CreateAgentOptions): Promise<AgentHandle> {
    this.stats.agentsCreated += 1;
    await this.#sleep(20 + this.#rng() * 60, options.signal);
    return { id: `sim-agent-${++this.#agentSeq}`, model: options.model };
  }

  async deleteAgent(_agent: AgentHandle): Promise<void> {
    this.stats.agentsDeleted += 1;
  }

  async run(request: RunRequest): Promise<RunResult> {
    const elapsedSec = (this.#now() - this.#startedAt) / 1000;
    this.#maybeRateLimit(elapsedSec);

    this.stats.runsStarted += 1;
    this.#inFlight += 1;
    try {
      // Contention: runs slow down as the backend gets crowded, which is what
      // makes chasing max concurrency a losing move past the soft limit.
      const crowding = Math.max(1, this.#inFlight / this.#opts.softConcurrencyLimit);
      const base = this.#opts.meanRunMs + (this.#rng() - 0.5) * 2 * this.#opts.runMsJitter;
      const durationMs = Math.max(120, base * crowding);
      await this.#sleep(durationMs, request.signal);

      const model = this.#models.find((m) => m.id === request.agent.model) ?? this.#models[0]!;
      const outputTokens = Math.round(this.#opts.meanOutputTokens * (0.6 + this.#rng() * 0.8));
      const inputTokens = Math.round(400 + this.#rng() * 900);
      const chargedCents = (outputTokens / 1000) * model.costWeight * 0.35;

      this.#spentCents += chargedCents;
      if (model.pool === "other_models") this.#apiSpentCents += chargedCents;
      else this.#autoSpentCents += chargedCents;

      this.stats.runsCompleted += 1;
      return {
        runId: `sim-run-${++this.#runSeq}`,
        model: model.id,
        durationMs,
        usage: { inputTokens, outputTokens, cachedInputTokens: 0, chargedCents },
      };
    } finally {
      this.#inFlight -= 1;
    }
  }

  async getAccountUsage(): Promise<AccountUsage> {
    const limit = this.#opts.accountLimitCents;
    const pct = (cents: number) => Math.min(100, (cents / limit) * 100);
    return {
      totalPercent: pct(this.#spentCents),
      autoPercent: pct(this.#autoSpentCents),
      apiPercent: pct(this.#apiSpentCents),
      includedSpendCents: this.#spentCents,
      limitCents: limit,
    };
  }

  #maybeRateLimit(elapsedSec: number): void {
    // Explicit demo windows first, then organic pressure past the soft limit.
    for (const w of this.#windows) {
      if (elapsedSec >= w.startSec && elapsedSec < w.endSec && this.#rng() < w.intensity) {
        this.stats.rateLimited += 1;
        throw new RateLimitError(w.retryInMs ?? 1500, "simulated 429 (scripted window)");
      }
    }
    const over = this.#inFlight - this.#opts.softConcurrencyLimit;
    if (over > 0 && this.#rng() < Math.min(0.8, over * 0.06)) {
      this.stats.rateLimited += 1;
      throw new RateLimitError(800 + Math.floor(this.#rng() * 1200), "simulated 429 (overload)");
    }
  }
}
