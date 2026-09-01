/**
 * Session lifecycle and cap enforcement (DESIGN.md §5 `BurnEngine`, §7).
 *
 * Owns the control loop: poll usage → evaluate the cap → emit a snapshot →
 * advance the concurrency ramp → reconcile the pool. Knows nothing about HTTP
 * or SSE; it emits `BurnEvent`s through a callback and Track 3 fans them out.
 */
import type { AgentBackend } from "./backend.ts";
import { ConcurrencyController } from "./concurrency.ts";
import type { BurnEvent, BurnEventHandler } from "./events.ts";
import { PoolManager } from "./pool-manager.ts";
import { BurnStrategy } from "./strategy.ts";
import { SyntheticTaskSource, type TaskSource } from "./task-source.ts";
import { UsageAggregator } from "./usage-aggregator.ts";
import type {
  AccountUsage,
  BurnConfig,
  BurnSnapshot,
  CapState,
  SessionStatus,
  StopReason,
} from "./types.ts";

export interface OrchestratorOptions {
  backend: AgentBackend;
  sessionId?: string;
  taskSource?: TaskSource;
  /** Cadence of the control loop (DESIGN.md §7.1: every 3–5s). */
  snapshotIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Injectable for tests; defaults to setInterval. */
  scheduler?: (fn: () => void, ms: number) => { cancel: () => void };
}

const DEFAULTS = {
  initialConcurrency: 20,
  minConcurrency: 3,
  maxConcurrency: 40,
  turnsPerAgent: 5,
  followUpsPerTask: 3,
  snapshotIntervalMs: 3_000,
};

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

export class BurnOrchestrator {
  readonly #backend: AgentBackend;
  readonly #sessionId: string;
  readonly #now: () => number;
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly #scheduler: (fn: () => void, ms: number) => { cancel: () => void };
  readonly #snapshotIntervalMs: number;
  readonly #explicitTaskSource?: TaskSource;

  #config: BurnConfig | null = null;
  #status: SessionStatus = "idle";
  #emit: BurnEventHandler = () => {};
  #aggregator = new UsageAggregator();
  #controller: ConcurrencyController | null = null;
  #strategy: BurnStrategy | null = null;
  #pool: PoolManager | null = null;
  #loop: { cancel: () => void } | null = null;
  #account: AccountUsage | undefined;
  #startedAt: number | null = null;
  #stopReason: StopReason | null = null;
  #stopped: Promise<StopReason> | null = null;
  #resolveStopped: ((r: StopReason) => void) | null = null;
  #stopping: Promise<void> | null = null;

  constructor(options: OrchestratorOptions) {
    this.#backend = options.backend;
    this.#sessionId = options.sessionId ?? `burn-${Date.now().toString(36)}`;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#snapshotIntervalMs = options.snapshotIntervalMs ?? DEFAULTS.snapshotIntervalMs;
    this.#explicitTaskSource = options.taskSource;
    this.#scheduler =
      options.scheduler ??
      ((fn, ms) => {
        const t = setInterval(fn, ms);
        if (typeof t.unref === "function") t.unref();
        return { cancel: () => clearInterval(t) };
      });
  }

  get sessionId(): string {
    return this.#sessionId;
  }

  get status(): SessionStatus {
    return this.#status;
  }

  /**
   * Starts the session. Resolves once the pool is running — not when the
   * session ends. Await `waitUntilStopped()` for that.
   *
   * `apiKey` is part of the Track 3 contract and is forwarded to backends that
   * need it; the simulated backend ignores it.
   */
  async start(apiKey: string, config: BurnConfig, onEvent: BurnEventHandler): Promise<void> {
    if (this.#status === "running" || this.#status === "paused") {
      throw new Error("session already running");
    }

    this.#config = config;
    this.#emit = onEvent;
    this.#status = "running";
    this.#stopReason = null;
    this.#startedAt = this.#now();
    this.#account = undefined;
    this.#aggregator = new UsageAggregator({ now: this.#now });
    this.#stopped = new Promise<StopReason>((resolve) => {
      this.#resolveStopped = resolve;
    });

    this.#controller = new ConcurrencyController({
      initial: config.initialConcurrency ?? DEFAULTS.initialConcurrency,
      min: config.minConcurrency ?? DEFAULTS.minConcurrency,
      max: config.maxConcurrency ?? DEFAULTS.maxConcurrency,
      now: this.#now,
    });

    this.#strategy = new BurnStrategy(config);
    this.#strategy.rank(await this.#backend.listModels());

    const taskSource =
      this.#explicitTaskSource ??
      new SyntheticTaskSource(config.followUpsPerTask ?? DEFAULTS.followUpsPerTask);

    this.#emit({
      type: "session.started",
      sessionId: this.#sessionId,
      config,
      at: this.#iso(),
    });
    if (apiKey) this.#emit({ type: "auth.ok" });

    this.#pool = new PoolManager({
      controller: this.#controller,
      onDrained: () => void this.#finish("user"),
      makeContext: () => ({
        sessionId: this.#sessionId,
        backend: this.#backend,
        strategy: this.#strategy!,
        taskSource,
        controller: this.#controller!,
        emit: (e) => this.#emit(e),
        onUsage: (usage) => {
          this.#aggregator.record(usage);
          // Dollar and token caps are computed from local state, so they are
          // checked the moment usage lands rather than waiting for the next
          // control-loop tick — otherwise the pool overshoots the cap by up to
          // one tick's worth of in-flight runs (DESIGN.md §9).
          this.#checkLocalCap();
        },
        shouldRun: () => this.#status === "running" || this.#status === "paused",
        isPaused: () => this.#status === "paused",
        turnsPerAgent: config.turnsPerAgent ?? DEFAULTS.turnsPerAgent,
        sleep: this.#sleep,
        now: this.#now,
      }),
    });

    this.#pool.start();
    this.#loop = this.#scheduler(() => void this.#tick(), this.#snapshotIntervalMs);
    // Emit an immediate snapshot so the UI has data before the first interval.
    await this.#tick();
  }

  pause(): void {
    if (this.#status !== "running") return;
    this.#status = "paused";
    this.#emit({ type: "session.paused", at: this.#iso() });
  }

  resume(): void {
    if (this.#status !== "paused") return;
    this.#status = "running";
    this.#emit({ type: "session.resumed", at: this.#iso() });
    this.#pool?.reconcile();
  }

  async stop(): Promise<void> {
    await this.#finish("user");
  }

  /** Resolves with the reason the session ended. */
  waitUntilStopped(): Promise<StopReason> {
    return this.#stopped ?? Promise.resolve(this.#stopReason ?? "user");
  }

  getSnapshot(): BurnSnapshot {
    const session = this.#aggregator.snapshot();
    return {
      sessionId: this.#sessionId,
      status: this.#status,
      session,
      account: this.#account,
      cap: this.#capState(),
      activeAgents: this.#pool?.activeCount ?? 0,
      targetConcurrency: this.#controller?.target ?? 0,
      agents: this.#pool?.states() ?? [],
      startedAt: this.#startedAt ? new Date(this.#startedAt).toISOString() : undefined,
      at: this.#iso(),
    };
  }

  /** One turn of the control loop. Exposed for deterministic tests. */
  async tick(): Promise<void> {
    await this.#tick();
  }

  async #tick(): Promise<void> {
    if (this.#status !== "running" && this.#status !== "paused") return;

    await this.#refreshAccountUsage();

    const cap = this.#capState();
    this.#emit({
      type: "usage.snapshot",
      session: this.#aggregator.snapshot(),
      account: this.#account,
      cap,
      activeAgents: this.#pool?.activeCount ?? 0,
      at: this.#iso(),
    });

    if (cap.reached) {
      await this.#finish("cap_reached");
      return;
    }

    const change = this.#controller?.tick();
    if (change) this.#emit({ type: "concurrency.adjusted", ...change, at: this.#iso() });
    this.#pool?.reconcile();
  }

  /**
   * Immediate cap check for caps that need no network call. Percent caps depend
   * on the account poll and stay on the tick path.
   */
  #checkLocalCap(): void {
    if (this.#status !== "running" && this.#status !== "paused") return;
    if (this.#config?.cap.type === "percent") return;
    if (this.#capState().reached) void this.#finish("cap_reached");
  }

  async #refreshAccountUsage(): Promise<void> {
    if (!this.#backend.getAccountUsage) return;
    try {
      this.#account = await this.#backend.getAccountUsage();
    } catch (err) {
      // §7.3 fallback: account metrics are best-effort. A percent cap without
      // them cannot be enforced, so surface it rather than burning blind.
      this.#account = undefined;
      this.#emit({
        type: "error",
        message: `account usage unavailable: ${(err as Error).message}`,
        recoverable: true,
        at: this.#iso(),
      });
    }
  }

  #capState(): CapState {
    const config = this.#config;
    if (!config) {
      return { type: "session_tokens", target: 0, current: 0, remaining: 0, reached: false };
    }

    const { type, value } = config.cap;
    let current: number;
    switch (type) {
      case "percent":
        // Unknown account usage reads as 0 so the cap never trips on missing
        // data; the `error` event above tells the UI why the ring is stalled.
        current = this.#account?.totalPercent ?? 0;
        break;
      case "dollars":
        current = this.#aggregator.costCents / 100;
        break;
      case "session_tokens":
      default:
        current = this.#aggregator.totalTokens;
        break;
    }

    const capReachable = type !== "percent" || this.#account !== undefined;
    return {
      type,
      target: value,
      current,
      remaining: Math.max(0, value - current),
      reached: capReachable && current >= value,
    };
  }

  async #finish(reason: StopReason): Promise<void> {
    if (this.#status === "stopped" || this.#status === "stopping") {
      await this.#stopping;
      return;
    }
    this.#status = "stopping";
    this.#stopReason = reason;

    this.#stopping = (async () => {
      this.#loop?.cancel();
      this.#loop = null;
      await this.#pool?.stop();
      this.#status = "stopped";
      this.#emit({ type: "session.stopped", reason, at: this.#iso() });
      this.#resolveStopped?.(reason);
      this.#resolveStopped = null;
    })();

    await this.#stopping;
  }

  #iso(): string {
    return new Date(this.#now()).toISOString();
  }
}
