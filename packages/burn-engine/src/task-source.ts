/**
 * Where workers get their work.
 *
 * This is the slot DESIGN.md §6.5 filled with `prompts.ts`. It is an interface
 * rather than a fixed prompt list so the pool can be driven by a real task
 * queue — a migration batch, per-package refactors, a test backfill — without
 * touching the orchestration layer. `SyntheticTaskSource` is the demo driver.
 */

export interface Task {
  id: string;
  input: string;
  /** Follow-up turns to send on the same agent after the initial run. */
  followUps: string[];
}

export interface TaskSource {
  /** Returns null when the queue is drained; the pool then winds down. */
  next(workerId: number): Promise<Task | null> | Task | null;
  /** Optional completion hook for queue-backed sources to ack/retry. */
  complete?(task: Task, outcome: "ok" | "failed"): void;
}

/**
 * A finite in-memory queue. This is what a real integration looks like:
 * hand the pool a list of jobs and it drains them at whatever concurrency
 * the provider tolerates.
 */
export class QueueTaskSource implements TaskSource {
  readonly #queue: Task[];
  constructor(tasks: Task[]) {
    this.#queue = tasks.slice();
  }
  get remaining(): number {
    return this.#queue.length;
  }
  next(): Task | null {
    return this.#queue.shift() ?? null;
  }
}

/**
 * Endless synthetic workload for demo runs. Deliberately generic: it exists to
 * keep the pool saturated so the dashboard has something to draw, not to shape
 * what a provider does with the request.
 */
export class SyntheticTaskSource implements TaskSource {
  readonly #followUpsPerTask: number;
  #seq = 0;

  constructor(followUpsPerTask = 3) {
    this.#followUpsPerTask = followUpsPerTask;
  }

  next(workerId: number): Task {
    const id = `task-${++this.#seq}`;
    return {
      id,
      input: `[demo workload ${id}] worker ${workerId} synthetic unit of work`,
      followUps: Array.from(
        { length: this.#followUpsPerTask },
        (_, i) => `[demo workload ${id}] continuation ${i + 1}`,
      ),
    };
  }
}
