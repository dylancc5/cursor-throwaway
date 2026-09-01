import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConcurrencyController } from "../src/concurrency.ts";

/** Controllable clock so the 60s recovery window costs no wall time. */
function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("ConcurrencyController", () => {
  it("decays the target by 0.7 on a 429 (DESIGN §6.1)", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 20, min: 3, max: 40, now: clock.now });
    const change = c.onRateLimit();
    assert.equal(change?.from, 20);
    assert.equal(change?.to, 14); // floor(20 * 0.7)
    assert.equal(c.target, 14);
  });

  it("doubles backoff on repeated 429s and caps at 60s", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 40, min: 3, max: 40, now: clock.now });
    const seen: number[] = [];
    for (let i = 0; i < 9; i++) {
      c.onRateLimit();
      seen.push(c.backoffMs);
    }
    assert.deepEqual(seen.slice(0, 4), [1000, 2000, 4000, 8000]);
    assert.equal(seen.at(-1), 60_000);
  });

  it("honours a provider Retry-After longer than its own backoff", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 20, min: 3, max: 40, now: clock.now });
    c.onRateLimit(30_000);
    assert.equal(c.remainingBackoffMs(), 30_000);
    clock.advance(29_999);
    assert.ok(c.isBackingOff());
    clock.advance(2);
    assert.equal(c.isBackingOff(), false);
  });

  it("never decays below min", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 5, min: 3, max: 40, now: clock.now });
    for (let i = 0; i < 20; i++) c.onRateLimit();
    assert.equal(c.target, 3);
  });

  it("ramps +2 only after 60s clean, and not while backing off", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 20, min: 3, max: 40, now: clock.now });

    assert.equal(c.tick(), null, "no ramp before the window elapses");

    c.onRateLimit(); // target 14, backoff 1s
    clock.advance(59_000);
    assert.equal(c.tick(), null, "still inside the quiet window");

    clock.advance(1_001); // past both the window and the 1s backoff
    const up = c.tick();
    assert.equal(up?.from, 14);
    assert.equal(up?.to, 16);

    clock.advance(60_001);
    assert.equal(c.tick()?.to, 18);
  });

  it("stops ramping at max", () => {
    const clock = fakeClock();
    const c = new ConcurrencyController({ initial: 39, min: 3, max: 40, now: clock.now });
    clock.advance(60_001);
    assert.equal(c.tick()?.to, 40);
    clock.advance(60_001);
    assert.equal(c.tick(), null);
    assert.equal(c.target, 40);
  });
});
