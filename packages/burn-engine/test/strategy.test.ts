import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelInfo } from "../src/backend.ts";
import { BurnStrategy } from "../src/strategy.ts";
import type { BurnConfig } from "../src/types.ts";

const MODELS: ModelInfo[] = [
  { id: "cheap-cursor", pool: "cursor_models", costWeight: 1, supportsFast: true },
  { id: "pricey-other", pool: "other_models", costWeight: 5, supportsFast: false },
  { id: "mid-cursor", pool: "cursor_models", costWeight: 2, supportsFast: true },
];

const config = (pref: BurnConfig["modelPreference"]): BurnConfig => ({
  cap: { type: "session_tokens", value: 1 },
  modelPreference: pref,
});

describe("BurnStrategy", () => {
  it("fastest_pool ranks by cost weight across pools", () => {
    const s = new BurnStrategy(config("fastest_pool"));
    assert.deepEqual(s.rank(MODELS).map((m) => m.id), ["pricey-other", "mid-cursor", "cheap-cursor"]);
  });

  it("cursor_models puts that pool first, still cost-ordered", () => {
    const s = new BurnStrategy(config("cursor_models"));
    assert.deepEqual(s.rank(MODELS).map((m) => m.id), ["mid-cursor", "cheap-cursor", "pricey-other"]);
  });

  it("round-robins across the ranked list", () => {
    const s = new BurnStrategy(config("fastest_pool"));
    s.rank(MODELS);
    assert.deepEqual(
      [s.selectModel(), s.selectModel(), s.selectModel(), s.selectModel()],
      ["pricey-other", "mid-cursor", "cheap-cursor", "pricey-other"],
    );
  });

  it("skips blocked models", () => {
    const s = new BurnStrategy(config("fastest_pool"));
    s.rank(MODELS);
    s.blockModel("pricey-other");
    const picks = [s.selectModel(), s.selectModel(), s.selectModel()];
    assert.equal(picks.includes("pricey-other"), false);
  });

  it("throws if used before ranking", () => {
    assert.throws(() => new BurnStrategy(config("fastest_pool")).selectModel(), /rank\(\)/);
  });
});
