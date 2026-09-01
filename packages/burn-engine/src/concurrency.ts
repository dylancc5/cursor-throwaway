/**
 * Adaptive parallelism (DESIGN.md §6.1).
 *
 *   on 429:                target *= 0.7, backoff = min(backoff * 2, 60s)
 *   on 60s without a 429:  target = min(target + 2, max)
 *
 * The controller is pure bookkeeping over an injected clock — it never sleeps
 * and never touches the network, so the recovery ramp is testable in
 * microseconds rather than minutes.
 */

export interface ConcurrencyControllerOptions {
  initial: number;
  min: number;
  max: number;
  /** Quiet period before the target ramps back up. */
  recoveryWindowMs?: number;
  rampStep?: number;
  decayFactor?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  now?: () => number;
}

export interface ConcurrencyChange {
  from: number;
  to: number;
  reason: string;
}

export class ConcurrencyController {
  readonly min: number;
  readonly max: number;
  readonly #recoveryWindowMs: number;
  readonly #rampStep: number;
  readonly #decayFactor: number;
  readonly #baseBackoffMs: number;
  readonly #maxBackoffMs: number;
  readonly #now: () => number;

  #target: number;
  #backoffMs = 0;
  #backoffUntil = 0;
  #lastRateLimitAt: number;
  #rateLimitCount = 0;

  constructor(options: ConcurrencyControllerOptions) {
    this.min = Math.max(1, options.min);
    this.max = Math.max(this.min, options.max);
    this.#recoveryWindowMs = options.recoveryWindowMs ?? 60_000;
    this.#rampStep = options.rampStep ?? 2;
    this.#decayFactor = options.decayFactor ?? 0.7;
    this.#baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.#maxBackoffMs = options.maxBackoffMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#target = this.#clamp(options.initial);
    // Start the ramp clock at construction so a clean first minute earns a bump.
    this.#lastRateLimitAt = this.#now();
  }

  get target(): number {
    return this.#target;
  }

  get backoffMs(): number {
    return this.#backoffMs;
  }

  get rateLimitCount(): number {
    return this.#rateLimitCount;
  }

  /** Milliseconds until new work may be dispatched; 0 when clear. */
  remainingBackoffMs(): number {
    return Math.max(0, this.#backoffUntil - this.#now());
  }

  isBackingOff(): boolean {
    return this.remainingBackoffMs() > 0;
  }

  /**
   * Record a 429. Returns the resulting change, or null when the target was
   * already at the floor (the backoff still lengthens in that case).
   */
  onRateLimit(retryInMs?: number): ConcurrencyChange | null {
    this.#rateLimitCount += 1;
    const now = this.#now();
    this.#lastRateLimitAt = now;

    this.#backoffMs = Math.min(
      this.#maxBackoffMs,
      this.#backoffMs === 0 ? this.#baseBackoffMs : this.#backoffMs * 2,
    );
    // Honour the provider's Retry-After when it asks for longer than our curve.
    const wait = Math.max(this.#backoffMs, retryInMs ?? 0);
    this.#backoffUntil = now + wait;

    const from = this.#target;
    const to = this.#clamp(Math.floor(from * this.#decayFactor));
    if (to === from) return null;
    this.#target = to;
    return { from, to, reason: `429 backoff (${this.#rateLimitCount} total)` };
  }

  /**
   * Advance the recovery ramp. Call on a timer; returns a change only when the
   * target actually moves.
   */
  tick(): ConcurrencyChange | null {
    const now = this.#now();
    if (now - this.#lastRateLimitAt < this.#recoveryWindowMs) return null;
    if (this.isBackingOff()) return null;

    const from = this.#target;
    const to = this.#clamp(from + this.#rampStep);
    // Reset the window even at ceiling, so the next tick is a fresh minute.
    this.#lastRateLimitAt = now;
    this.#backoffMs = 0;
    if (to === from) return null;
    this.#target = to;
    return { from, to, reason: `${Math.round(this.#recoveryWindowMs / 1000)}s without 429` };
  }

  /** Operator/UI override; clamped into [min, max]. */
  setTarget(value: number, reason = "manual override"): ConcurrencyChange | null {
    const from = this.#target;
    const to = this.#clamp(Math.floor(value));
    if (to === from) return null;
    this.#target = to;
    return { from, to, reason };
  }

  #clamp(v: number): number {
    return Math.min(this.max, Math.max(this.min, v));
  }
}
