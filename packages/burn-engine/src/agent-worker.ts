/**
 * One worker = one agent slot (DESIGN.md §6.4).
 *
 * Lifecycle per worker: create agent → run a task → send its follow-ups on the
 * same agent → repeat → recycle the agent every `turnsPerAgent` turns. A 429
 * is reported to the shared ConcurrencyController and the worker waits out the
 * global backoff rather than retrying on its own schedule, so the whole pool
 * backs off together instead of stampeding the provider.
 */
import { RateLimitError, type AgentBackend, type AgentHandle } from "./backend.ts";
import type { ConcurrencyController } from "./concurrency.ts";
import type { BurnEvent } from "./events.ts";
import type { BurnStrategy } from "./strategy.ts";
import type { Task, TaskSource } from "./task-source.ts";
import type { AgentState, TokenUsage } from "./types.ts";

export interface WorkerContext {
  sessionId: string;
  backend: AgentBackend;
  strategy: BurnStrategy;
  taskSource: TaskSource;
  controller: ConcurrencyController;
  emit: (event: BurnEvent) => void;
  onUsage: (usage: TokenUsage) => void;
  /** Pool-level gate: false ends the worker loop cleanly. */
  shouldRun: () => boolean;
  /** True while paused — the worker idles instead of starting new runs. */
  isPaused: () => boolean;
  turnsPerAgent: number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  now: () => number;
}

const iso = (now: () => number) => new Date(now()).toISOString();

export class AgentWorker {
  readonly workerId: number;
  readonly #ctx: WorkerContext;

  #agent: AgentHandle | null = null;
  #turnsOnAgent = 0;
  #turnsTotal = 0;
  #tokens = 0;
  #phase: AgentState["phase"] = "spawning";
  #tasksDrained = false;

  constructor(workerId: number, ctx: WorkerContext) {
    this.workerId = workerId;
    this.#ctx = ctx;
  }

  get phase(): AgentState["phase"] {
    return this.#phase;
  }

  /** True once the task source is exhausted — the pool stops replacing us. */
  get drained(): boolean {
    return this.#tasksDrained;
  }

  state(): AgentState {
    return {
      agentId: this.#agent?.id ?? `worker-${this.workerId}-pending`,
      workerId: this.workerId,
      phase: this.#phase,
      model: this.#agent?.model ?? "-",
      turnsCompleted: this.#turnsTotal,
      tokens: this.#tokens,
    };
  }

  async run(signal: AbortSignal): Promise<void> {
    const { ctx } = this;
    try {
      while (ctx.shouldRun() && !signal.aborted) {
        if (ctx.isPaused()) {
          this.#phase = "idle";
          await ctx.sleep(150, signal);
          continue;
        }

        const wait = ctx.controller.remainingBackoffMs();
        if (wait > 0) {
          this.#phase = "idle";
          await ctx.sleep(Math.min(wait, 1000), signal);
          continue;
        }

        const task = await ctx.taskSource.next(this.workerId);
        if (!task) {
          this.#tasksDrained = true;
          break;
        }

        if (!this.#agent) await this.#spawn(signal);
        const ok = await this.#runTask(task, signal);
        ctx.taskSource.complete?.(task, ok ? "ok" : "failed");

        if (this.#turnsOnAgent >= ctx.turnsPerAgent) await this.#recycle(signal);
      }
    } catch (err) {
      if (!signal.aborted) {
        ctx.emit({
          type: "error",
          message: `worker ${this.workerId}: ${(err as Error).message}`,
          recoverable: false,
          at: iso(ctx.now),
        });
      }
    } finally {
      await this.#teardown();
    }
  }

  private get ctx(): WorkerContext {
    return this.#ctx;
  }

  async #spawn(signal: AbortSignal): Promise<void> {
    const { ctx } = this;
    this.#phase = "spawning";
    const model = ctx.strategy.selectModel();
    this.#agent = await ctx.backend.createAgent({
      model,
      metadata: { burn_session: ctx.sessionId, worker: String(this.workerId) },
      signal,
    });
    this.#turnsOnAgent = 0;
    ctx.emit({
      type: "agent.spawned",
      agentId: this.#agent.id,
      workerId: this.workerId,
      at: iso(ctx.now),
    });
  }

  /** Runs the task plus its follow-ups. Returns false if a turn failed hard. */
  async #runTask(task: Task, signal: AbortSignal): Promise<boolean> {
    const turns = [task.input, ...task.followUps];
    for (const input of turns) {
      if (!this.ctx.shouldRun() || signal.aborted) return true;
      if (this.#turnsOnAgent >= this.ctx.turnsPerAgent) break;
      const ok = await this.#runTurn(input, signal);
      if (!ok) return false;
    }
    return true;
  }

  async #runTurn(input: string, signal: AbortSignal): Promise<boolean> {
    const { ctx } = this;
    const agent = this.#agent;
    if (!agent) return false;

    this.#phase = "running";
    ctx.emit({
      type: "run.started",
      agentId: agent.id,
      runId: "pending",
      model: agent.model,
      at: iso(ctx.now),
    });

    try {
      const result = await ctx.backend.run({ agent, input, signal });
      const tokens = result.usage.inputTokens + result.usage.outputTokens;
      this.#tokens += tokens;
      this.#turnsOnAgent += 1;
      this.#turnsTotal += 1;
      ctx.onUsage(result.usage);
      ctx.emit({
        type: "run.completed",
        agentId: agent.id,
        runId: result.runId,
        usage: result.usage,
        durationMs: result.durationMs,
        at: iso(ctx.now),
      });
      return true;
    } catch (err) {
      if (signal.aborted) return false;

      if (err instanceof RateLimitError) {
        // The controller owns the global backoff; we only report and yield.
        const change = ctx.controller.onRateLimit(err.retryInMs);
        ctx.emit({
          type: "rate_limit",
          retryInMs: err.retryInMs,
          concurrency: ctx.controller.target,
          at: iso(ctx.now),
        });
        if (change) {
          ctx.emit({ type: "concurrency.adjusted", ...change, at: iso(ctx.now) });
        }
        this.#phase = "idle";
        return true;
      }

      ctx.emit({
        type: "error",
        message: `run failed on ${agent.id}: ${(err as Error).message}`,
        recoverable: true,
        at: iso(ctx.now),
      });
      // A hard failure taints the agent; drop it and let the loop respawn.
      await this.#discardAgent();
      return false;
    }
  }

  async #recycle(signal: AbortSignal): Promise<void> {
    const { ctx } = this;
    const previous = this.#agent;
    this.#phase = "recycling";
    await this.#discardAgent();
    if (previous) {
      ctx.emit({
        type: "agent.recycled",
        agentId: previous.id,
        turnsCompleted: this.#turnsTotal,
        at: iso(ctx.now),
      });
    }
    if (ctx.shouldRun() && !signal.aborted) await this.#spawn(signal);
  }

  async #discardAgent(): Promise<void> {
    const agent = this.#agent;
    this.#agent = null;
    this.#turnsOnAgent = 0;
    if (!agent) return;
    try {
      await this.#ctx.backend.deleteAgent(agent);
    } catch {
      // Best-effort cleanup: a failed delete must not break the worker loop.
    }
  }

  async #teardown(): Promise<void> {
    await this.#discardAgent();
    this.#phase = "stopped";
  }
}
