/**
 * Keeps the live worker count tracking the ConcurrencyController's target
 * (DESIGN.md §5, §6.1).
 *
 * Scaling up starts new workers; scaling down aborts the most recently started
 * ones, which are the least likely to be mid-turn on a long run. Reconciliation
 * is a poll rather than an event so a target change from any source — 429
 * decay, recovery ramp, manual override — converges the same way.
 */
import type { AgentWorker, WorkerContext } from "./agent-worker.ts";
import { AgentWorker as Worker } from "./agent-worker.ts";
import type { ConcurrencyController } from "./concurrency.ts";
import type { AgentState } from "./types.ts";

interface Slot {
  worker: AgentWorker;
  abort: AbortController;
  done: Promise<void>;
}

export interface PoolManagerOptions {
  controller: ConcurrencyController;
  makeContext: (workerId: number) => WorkerContext;
  /** Called when every worker has exited because the task source drained. */
  onDrained?: () => void;
}

export class PoolManager {
  readonly #controller: ConcurrencyController;
  readonly #makeContext: (workerId: number) => WorkerContext;
  readonly #onDrained?: () => void;
  readonly #slots = new Map<number, Slot>();

  #nextWorkerId = 1;
  #running = false;
  #drained = false;

  constructor(options: PoolManagerOptions) {
    this.#controller = options.controller;
    this.#makeContext = options.makeContext;
    this.#onDrained = options.onDrained;
  }

  get activeCount(): number {
    return this.#slots.size;
  }

  get drained(): boolean {
    return this.#drained;
  }

  states(): AgentState[] {
    return [...this.#slots.values()].map((s) => s.worker.state());
  }

  start(): void {
    this.#running = true;
    this.reconcile();
  }

  /** Brings the live worker count in line with the current target. */
  reconcile(): void {
    if (!this.#running || this.#drained) return;

    const target = this.#controller.target;
    while (this.#slots.size < target) this.#spawnSlot();

    if (this.#slots.size > target) {
      const excess = this.#slots.size - target;
      // Newest first — oldest workers are furthest through their agent's turns.
      const ids = [...this.#slots.keys()].sort((a, b) => b - a).slice(0, excess);
      for (const id of ids) this.#slots.get(id)?.abort.abort(new Error("scale down"));
    }
  }

  async stop(): Promise<void> {
    this.#running = false;
    for (const slot of this.#slots.values()) slot.abort.abort(new Error("pool stopped"));
    await Promise.allSettled([...this.#slots.values()].map((s) => s.done));
    this.#slots.clear();
  }

  #spawnSlot(): void {
    const workerId = this.#nextWorkerId++;
    const abort = new AbortController();
    const worker = new Worker(workerId, this.#makeContext(workerId));

    const done = worker
      .run(abort.signal)
      .catch(() => undefined)
      .finally(() => {
        this.#slots.delete(workerId);
        if (worker.drained) this.#markDrained();
        // A worker that exited on its own while we still want capacity gets
        // replaced on the next reconcile tick.
        if (this.#running && !this.#drained) this.reconcile();
      });

    this.#slots.set(workerId, { worker, abort, done });
  }

  #markDrained(): void {
    if (this.#drained) return;
    this.#drained = true;
    for (const slot of this.#slots.values()) slot.abort.abort(new Error("tasks drained"));
    this.#onDrained?.();
  }
}
