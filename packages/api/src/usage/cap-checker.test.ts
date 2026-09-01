import assert from "node:assert/strict";
import { test } from "node:test";
import type { BurnConfig } from "@cursor-burner/shared";
import { buildCapProgress, isCapReached } from "./cap-checker.js";

const baseConfig = (type: BurnConfig["cap"]["type"], value: number): BurnConfig => ({
  cap: { type, value },
  modelPreference: "fastest_pool",
  initialConcurrency: 20,
});

test("percent cap uses account totalPercent", () => {
  const config = baseConfig("percent", 95);
  const account = {
    totalPercent: 96,
    autoPercent: 50,
    apiPercent: 40,
    includedSpendCents: 1500,
    limitCents: 2000,
  };
  assert.equal(isCapReached(config, { tokens: 0, costCents: 0 }, account), true);
  assert.equal(isCapReached(config, { tokens: 0, costCents: 0 }, { ...account, totalPercent: 50 }), false);
});

test("percent cap does not trigger without account data", () => {
  const config = baseConfig("percent", 95);
  assert.equal(isCapReached(config, { tokens: 1_000_000, costCents: 9999 }, null), false);
});

test("dollars cap uses session costCents", () => {
  const config = baseConfig("dollars", 15);
  assert.equal(isCapReached(config, { tokens: 0, costCents: 1500 }, null), true);
  assert.equal(isCapReached(config, { tokens: 0, costCents: 1400 }, null), false);
});

test("session_tokens cap uses session tokens", () => {
  const config = baseConfig("session_tokens", 1_000_000);
  assert.equal(isCapReached(config, { tokens: 1_000_001, costCents: 0 }, null), true);
});

test("buildCapProgress computes remaining", () => {
  const progress = buildCapProgress(
    baseConfig("dollars", 20),
    { tokens: 5000, costCents: 750 },
    null,
  );
  assert.equal(progress.current, 7.5);
  assert.equal(progress.remaining, 12.5);
});
