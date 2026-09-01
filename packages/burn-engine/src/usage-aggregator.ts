/**
 * Session usage rollup (DESIGN.md §5, §7.3 "guaranteed" layer).
 *
 * Sums per-run usage and derives a burn rate. The rate is a sliding window
 * rather than a session average so the UI line reacts to a concurrency drop
 * within seconds instead of dragging the whole session's history behind it.
 */
import type { SessionTotals, TokenUsage } from "./types.ts";

export interface UsageAggregatorOptions {
  /** Width of the burn-rate window. */
  windowMs?: number;
  now?: () => number;
}

interface Sample {
  at: number;
  tokens: number;
}

export class UsageAggregator {
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #samples: Sample[] = [];

  #inputTokens = 0;
  #outputTokens = 0;
  #cachedInputTokens = 0;
  #costCents = 0;
  #runs = 0;
  #startedAt: number;

  constructor(options: UsageAggregatorOptions = {}) {
    this.#windowMs = options.windowMs ?? 15_000;
    this.#now = options.now ?? Date.now;
    this.#startedAt = this.#now();
  }

  reset(): void {
    this.#samples.length = 0;
    this.#inputTokens = 0;
    this.#outputTokens = 0;
    this.#cachedInputTokens = 0;
    this.#costCents = 0;
    this.#runs = 0;
    this.#startedAt = this.#now();
  }

  record(usage: TokenUsage): void {
    this.#inputTokens += usage.inputTokens;
    this.#outputTokens += usage.outputTokens;
    this.#cachedInputTokens += usage.cachedInputTokens;
    this.#costCents += usage.chargedCents;
    this.#runs += 1;
    this.#samples.push({ at: this.#now(), tokens: usage.inputTokens + usage.outputTokens });
    this.#trim();
  }

  get totalTokens(): number {
    return this.#inputTokens + this.#outputTokens;
  }

  get costCents(): number {
    return this.#costCents;
  }

  get runs(): number {
    return this.#runs;
  }

  /** Tokens per second over the trailing window. */
  tokensPerSec(): number {
    this.#trim();
    if (this.#samples.length === 0) return 0;
    const now = this.#now();
    // Before the window fills, divide by actual elapsed time — otherwise the
    // first few seconds of a session read as an implausibly low rate.
    const span = Math.min(this.#windowMs, Math.max(1, now - this.#startedAt));
    const tokens = this.#samples.reduce((sum, s) => sum + s.tokens, 0);
    return (tokens / span) * 1000;
  }

  snapshot(): SessionTotals {
    return {
      tokens: this.totalTokens,
      costCents: this.#costCents,
      tokensPerSec: this.tokensPerSec(),
    };
  }

  #trim(): void {
    const cutoff = this.#now() - this.#windowMs;
    while (this.#samples.length > 0 && this.#samples[0]!.at < cutoff) this.#samples.shift();
  }
}
