import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UsageAggregator } from "../src/usage-aggregator.ts";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const usage = (input: number, output: number, cents = 1) => ({
  inputTokens: input,
  outputTokens: output,
  cachedInputTokens: 0,
  chargedCents: cents,
});

describe("UsageAggregator", () => {
  it("sums tokens, cost, and run count", () => {
    const a = new UsageAggregator({ now: fakeClock().now });
    a.record(usage(100, 900, 2.5));
    a.record(usage(200, 800, 1.5));
    assert.equal(a.totalTokens, 2000);
    assert.equal(a.costCents, 4);
    assert.equal(a.runs, 2);
  });

  it("reports zero rate before any runs", () => {
    assert.equal(new UsageAggregator({ now: fakeClock().now }).tokensPerSec(), 0);
  });

  it("divides by elapsed time before the window fills", () => {
    const clock = fakeClock();
    const a = new UsageAggregator({ windowMs: 10_000, now: clock.now });
    clock.advance(2_000);
    a.record(usage(0, 4_000));
    // 4000 tokens over 2s elapsed, not over the full 10s window.
    assert.equal(Math.round(a.tokensPerSec()), 2000);
  });

  it("drops samples outside the window so the rate decays", () => {
    const clock = fakeClock();
    const a = new UsageAggregator({ windowMs: 10_000, now: clock.now });
    clock.advance(10_000);
    a.record(usage(0, 10_000));
    assert.equal(Math.round(a.tokensPerSec()), 1000);

    clock.advance(10_001); // sample now older than the window
    assert.equal(a.tokensPerSec(), 0);
    assert.equal(a.totalTokens, 10_000, "totals are cumulative, not windowed");
  });
});
