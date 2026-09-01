/**
 * Stage demo for Track 2.
 *
 *   node demo/demo.ts                    # default 90s scripted session
 *   node demo/demo.ts --seed 7 --cap 60  # same script, different roll
 *
 * Runs the real orchestrator against `SimulatedBackend`. The seed fixes the
 * whole session, so a rehearsed run reproduces exactly: the 429 storm lands at
 * t+20s, the controller decays and re-ramps, and the cap trips on cue.
 */
import { BurnOrchestrator } from "../src/index.ts";
import { SimulatedBackend } from "../src/index.ts";
import type { BurnEvent } from "../src/events.ts";
import type { BurnConfig } from "../src/types.ts";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

const seed = arg("seed", 42);
const capPercent = arg("cap", 55);
const maxSeconds = arg("seconds", 120);

const backend = new SimulatedBackend({
  seed,
  meanRunMs: 900,
  meanOutputTokens: 7_000,
  softConcurrencyLimit: 18,
  // Sized so a default run lasts ~70s: long enough for the 429 storm at t+20s
  // and the 60s recovery ramp to both land before the cap trips.
  accountLimitCents: 15_000,
  // The scripted moment: a hard 429 storm 20s in, so the concurrency panel has
  // something to do while you are talking about it.
  rateLimitWindows: [{ startSec: 20, endSec: 32, intensity: 0.55, retryInMs: 1_200 }],
});
backend.resetClock();

const config: BurnConfig = {
  cap: { type: "percent", value: capPercent },
  modelPreference: "fastest_pool",
  initialConcurrency: 20,
  minConcurrency: 3,
  maxConcurrency: 40,
  turnsPerAgent: 5,
  followUpsPerTask: 3,
};

const orch = new BurnOrchestrator({ backend, snapshotIntervalMs: 2_000 });
const t0 = Date.now();
const clock = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`.padStart(6);

let rateLimits = 0;
let runs = 0;

function onEvent(e: BurnEvent): void {
  switch (e.type) {
    case "session.started":
      console.log(`${clock()}  ▸ session ${e.sessionId} — cap ${e.config.cap.value}${e.config.cap.type === "percent" ? "%" : ""}`);
      break;
    case "run.completed":
      runs += 1;
      break;
    case "rate_limit":
      rateLimits += 1;
      break;
    case "concurrency.adjusted":
      console.log(`${clock()}  ⇅ concurrency ${e.from} → ${e.to}  (${e.reason})`);
      break;
    case "usage.snapshot": {
      const pct = e.account ? `${e.account.totalPercent.toFixed(1)}%` : "n/a";
      const bar = e.account ? renderBar(e.account.totalPercent, capPercent) : "";
      console.log(
        `${clock()}  ${bar} acct ${pct.padStart(6)}` +
          `  agents ${String(e.activeAgents).padStart(2)}` +
          `  ${Math.round(e.session.tokensPerSec).toLocaleString().padStart(7)} tok/s` +
          `  ${e.session.tokens.toLocaleString().padStart(9)} tok` +
          `  $${(e.session.costCents / 100).toFixed(2).padStart(6)}` +
          `  429×${rateLimits}`,
      );
      break;
    }
    case "session.stopped":
      console.log(`${clock()}  ■ stopped — ${e.reason}`);
      break;
    case "error":
      console.log(`${clock()}  ! ${e.message}`);
      break;
  }
}

function renderBar(current: number, target: number, width = 24): string {
  const filled = Math.min(width, Math.round((current / target) * width));
  return `[${"█".repeat(filled)}${"·".repeat(width - filled)}]`;
}

const stopTimer = setTimeout(() => {
  console.log(`${clock()}  … time limit reached, stopping`);
  void orch.stop();
}, maxSeconds * 1_000);

await orch.start("demo-key", config, onEvent);
const reason = await orch.waitUntilStopped();
clearTimeout(stopTimer);

const snap = orch.getSnapshot();
console.log("\n─── summary ───────────────────────────────");
console.log(`reason        ${reason}`);
console.log(`seed          ${seed} (replayable)`);
console.log(`runs          ${runs}`);
console.log(`tokens        ${snap.session.tokens.toLocaleString()}`);
console.log(`cost          $${(snap.session.costCents / 100).toFixed(2)}`);
console.log(`account       ${snap.account ? snap.account.totalPercent.toFixed(1) + "%" : "n/a"} of ${capPercent}% cap`);
console.log(`429s          ${rateLimits}`);
console.log(`agents made   ${backend.stats.agentsCreated}  (deleted ${backend.stats.agentsDeleted})`);
console.log(`final target  ${snap.targetConcurrency}`);
