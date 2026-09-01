import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentBackend, AgentHandle, ModelInfo, RunRequest, RunResult } from "../src/backend.ts";
import { RateLimitError } from "../src/backend.ts";
import type { BurnEvent } from "../src/events.ts";
import { BurnOrchestrator } from "../src/orchestrator.ts";
import { QueueTaskSource, type Task } from "../src/task-source.ts";
import type { AccountUsage, BurnConfig } from "../src/types.ts";

const MODELS: ModelInfo[] = [
  { id: "m-fast", pool: "cursor_models", costWeight: 1, supportsFast: true },
];

/** Backend with no latency, so tests run at full speed and stay deterministic. */
class StubBackend implements AgentBackend {
  agents = 0;
  deleted = 0;
  runs = 0;
  failNextWith: Error | null = null;
  account: AccountUsage | null = null;
  accountError: Error | null = null;
  tokensPerRun = 1000;
  centsPerRun = 10;

  async listModels(): Promise<ModelInfo[]> {
    return MODELS;
  }
  async createAgent(): Promise<AgentHandle> {
    this.agents += 1;
    return { id: `a${this.agents}`, model: "m-fast" };
  }
  async deleteAgent(): Promise<void> {
    this.deleted += 1;
  }
  async run(_r: RunRequest): Promise<RunResult> {
    if (this.failNextWith) {
      const err = this.failNextWith;
      this.failNextWith = null;
      throw err;
    }
    this.runs += 1;
    return {
      runId: `r${this.runs}`,
      model: "m-fast",
      durationMs: 1,
      usage: {
        inputTokens: 0,
        outputTokens: this.tokensPerRun,
        cachedInputTokens: 0,
        chargedCents: this.centsPerRun,
      },
    };
  }
  async getAccountUsage(): Promise<AccountUsage> {
    if (this.accountError) throw this.accountError;
    if (!this.account) throw new Error("no account data");
    return this.account;
  }
}

const config = (over: Partial<BurnConfig> = {}): BurnConfig => ({
  cap: { type: "session_tokens", value: 10_000 },
  modelPreference: "fastest_pool",
  initialConcurrency: 2,
  minConcurrency: 1,
  maxConcurrency: 4,
  turnsPerAgent: 2,
  followUpsPerTask: 0,
  ...over,
});

const tasks = (n: number): Task[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, input: `task ${i}`, followUps: [] }));

/** Manual scheduler: the test decides when the control loop ticks. */
function manualScheduler() {
  let fn: (() => void) | null = null;
  return {
    scheduler: (f: () => void) => {
      fn = f;
      return { cancel: () => (fn = null) };
    },
    fire: () => fn?.(),
  };
}

function collect(): { events: BurnEvent[]; on: (e: BurnEvent) => void } {
  const events: BurnEvent[] = [];
  return { events, on: (e) => events.push(e) };
}

describe("BurnOrchestrator", () => {
  it("runs a finite queue to completion and stops", async () => {
    const backend = new StubBackend();
    const sink = collect();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(6)),
      scheduler: manualScheduler().scheduler,
    });

    await orch.start("key", config(), sink.on);
    const reason = await orch.waitUntilStopped();

    assert.equal(reason, "user");
    assert.equal(backend.runs, 6);
    assert.equal(orch.status, "stopped");
    assert.equal(orch.getSnapshot().activeAgents, 0, "pool fully drained");
    assert.equal(backend.deleted, backend.agents, "every agent cleaned up");
  });

  it("emits the session.started / session.stopped bookends", async () => {
    const sink = collect();
    const orch = new BurnOrchestrator({
      backend: new StubBackend(),
      taskSource: new QueueTaskSource(tasks(2)),
      scheduler: manualScheduler().scheduler,
    });
    await orch.start("key", config(), sink.on);
    await orch.waitUntilStopped();

    assert.equal(sink.events[0]?.type, "session.started");
    assert.equal(sink.events.at(-1)?.type, "session.stopped");
    assert.ok(sink.events.some((e) => e.type === "agent.spawned"));
    assert.ok(sink.events.some((e) => e.type === "run.completed"));
  });

  it("stops with cap_reached once session tokens cross the cap", async () => {
    const backend = new StubBackend();
    backend.tokensPerRun = 2_500;
    const sink = collect();
    const m = manualScheduler();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(1_000)),
      scheduler: m.scheduler,
    });

    await orch.start("key", config({ cap: { type: "session_tokens", value: 10_000 } }), sink.on);
    while (orch.status === "running") {
      m.fire();
      await new Promise((r) => setImmediate(r));
    }
    const reason = await orch.waitUntilStopped();

    assert.equal(reason, "cap_reached");
    assert.ok(orch.getSnapshot().session.tokens >= 10_000);
    assert.equal(orch.getSnapshot().cap.reached, true);
  });

  it("enforces a dollar cap from charged cents", async () => {
    const backend = new StubBackend();
    backend.centsPerRun = 60; // $0.60 per run
    const m = manualScheduler();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(1_000)),
      scheduler: m.scheduler,
    });

    await orch.start("key", config({ cap: { type: "dollars", value: 3 } }), () => {});
    while (orch.status === "running") {
      m.fire();
      await new Promise((r) => setImmediate(r));
    }

    assert.equal(await orch.waitUntilStopped(), "cap_reached");
    assert.ok(orch.getSnapshot().session.costCents >= 300);
  });

  it("enforces a percent cap from account usage", async () => {
    const backend = new StubBackend();
    backend.account = {
      totalPercent: 10,
      autoPercent: 5,
      apiPercent: 5,
      includedSpendCents: 200,
      limitCents: 2000,
    };
    const m = manualScheduler();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(1_000)),
      scheduler: m.scheduler,
    });

    await orch.start("key", config({ cap: { type: "percent", value: 95 } }), () => {});
    assert.equal(orch.status, "running", "10% is well under a 95% cap");

    backend.account = { ...backend.account, totalPercent: 96 };
    m.fire();
    await new Promise((r) => setImmediate(r));

    assert.equal(await orch.waitUntilStopped(), "cap_reached");
  });

  it("does not trip a percent cap when account usage is unavailable", async () => {
    const backend = new StubBackend();
    backend.accountError = new Error("dashboard RPC 403");
    const sink = collect();
    const m = manualScheduler();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(4)),
      scheduler: m.scheduler,
    });

    await orch.start("key", config({ cap: { type: "percent", value: 95 } }), sink.on);
    await orch.waitUntilStopped();

    const snap = orch.getSnapshot();
    assert.equal(snap.cap.reached, false, "missing data must not read as 0% => never capped");
    assert.ok(
      sink.events.some((e) => e.type === "error" && e.message.includes("account usage unavailable")),
      "the UI is told why the ring is stalled",
    );
  });

  it("reports a 429 and drops the concurrency target", async () => {
    const backend = new StubBackend();
    backend.failNextWith = new RateLimitError(5, "429");
    const sink = collect();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(4)),
      scheduler: manualScheduler().scheduler,
    });

    await orch.start("key", config({ initialConcurrency: 4, minConcurrency: 1 }), sink.on);
    await orch.waitUntilStopped();

    const limit = sink.events.find((e) => e.type === "rate_limit");
    assert.ok(limit, "rate_limit event emitted");
    const adjusted = sink.events.find(
      (e) => e.type === "concurrency.adjusted" && e.reason.includes("429"),
    );
    assert.ok(adjusted, "concurrency.adjusted emitted with a 429 reason");
    assert.equal(adjusted.type === "concurrency.adjusted" && adjusted.to < adjusted.from, true);
  });

  it("pauses and resumes without ending the session", async () => {
    const orch = new BurnOrchestrator({
      backend: new StubBackend(),
      taskSource: new QueueTaskSource(tasks(500)),
      scheduler: manualScheduler().scheduler,
    });
    const sink = collect();
    await orch.start("key", config(), sink.on);

    orch.pause();
    assert.equal(orch.status, "paused");
    orch.resume();
    assert.equal(orch.status, "running");

    await orch.stop();
    assert.equal(orch.status, "stopped");
    assert.ok(sink.events.some((e) => e.type === "session.paused"));
    assert.ok(sink.events.some((e) => e.type === "session.resumed"));
  });

  it("is idempotent on repeated stop()", async () => {
    const sink = collect();
    const orch = new BurnOrchestrator({
      backend: new StubBackend(),
      taskSource: new QueueTaskSource(tasks(100)),
      scheduler: manualScheduler().scheduler,
    });
    await orch.start("key", config(), sink.on);
    await Promise.all([orch.stop(), orch.stop(), orch.stop()]);

    const stops = sink.events.filter((e) => e.type === "session.stopped");
    assert.equal(stops.length, 1);
  });

  it("rejects a concurrent start on a live session", async () => {
    const orch = new BurnOrchestrator({
      backend: new StubBackend(),
      taskSource: new QueueTaskSource(tasks(100)),
      scheduler: manualScheduler().scheduler,
    });
    await orch.start("key", config(), () => {});
    await assert.rejects(() => orch.start("key", config(), () => {}), /already running/);
    await orch.stop();
  });

  it("recycles an agent every turnsPerAgent turns", async () => {
    const backend = new StubBackend();
    const sink = collect();
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(8)),
      scheduler: manualScheduler().scheduler,
    });

    await orch.start("key", config({ initialConcurrency: 1, turnsPerAgent: 2 }), sink.on);
    await orch.waitUntilStopped();

    const recycled = sink.events.filter((e) => e.type === "agent.recycled");
    assert.ok(recycled.length >= 3, `expected >=3 recycles for 8 turns at 2/agent, got ${recycled.length}`);
  });
});

describe("cap overshoot", () => {
  it("does not blow far past a token cap between control-loop ticks", async () => {
    // The scheduler never fires here, so the only thing that can stop the pool
    // is the immediate local cap check on the usage path.
    const backend = new StubBackend();
    backend.tokensPerRun = 1_000;
    const orch = new BurnOrchestrator({
      backend,
      taskSource: new QueueTaskSource(tasks(10_000)),
      scheduler: () => ({ cancel: () => {} }),
    });

    await orch.start(
      "key",
      config({ cap: { type: "session_tokens", value: 10_000 }, initialConcurrency: 4 }),
      () => {},
    );
    assert.equal(await orch.waitUntilStopped(), "cap_reached");

    const tokens = orch.getSnapshot().session.tokens;
    assert.ok(tokens >= 10_000, `expected the cap to be met, got ${tokens}`);
    // Bounded by the runs already in flight when the cap tripped, not by the
    // whole remaining queue.
    assert.ok(tokens < 20_000, `overshoot too large: ${tokens}`);
  });
});
