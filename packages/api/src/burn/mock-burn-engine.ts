import type {
  BurnConfig,
  BurnEngine,
  BurnEvent,
  BurnSnapshot,
} from "@cursor-burner/shared";
import { buildCapProgress } from "../usage/cap-checker.js";

const EMPTY_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
};

/**
 * Mock burn engine for Track 3 until Track 2 BurnOrchestrator is integrated.
 */
export class MockBurnEngine implements BurnEngine {
  private running = false;
  private paused = false;
  private sessionId = "";
  private config: BurnConfig | null = null;
  private onEvent: ((event: BurnEvent) => void) | null = null;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private tokens = 0;
  private costCents = 0;
  private activeAgents = 0;
  private completedRuns = 0;
  private concurrency = 20;
  private workerId = 0;
  private tokenHistory: Array<{ at: number; tokens: number }> = [];

  async start(
    _apiKey: string,
    sessionId: string,
    config: BurnConfig,
    onEvent: (event: BurnEvent) => void,
  ): Promise<void> {
    if (this.running) {
      await this.stop();
    }

    this.running = true;
    this.paused = false;
    this.sessionId = sessionId;
    this.config = config;
    this.onEvent = onEvent;
    this.concurrency = config.initialConcurrency ?? 20;
    this.tokens = 0;
    this.costCents = 0;
    this.activeAgents = 0;
    this.completedRuns = 0;
    this.tokenHistory = [];

    this.emit({
      type: "session.started",
      sessionId,
      config,
      at: new Date().toISOString(),
    });

    for (let i = 0; i < Math.min(this.concurrency, 5); i++) {
      this.spawnAgent();
    }

    this.workerInterval = setInterval(() => {
      if (!this.running || this.paused) return;
      this.simulateRun();
    }, 2000);

    this.snapshotInterval = setInterval(() => {
      if (!this.running) return;
      this.emitSnapshot();
    }, 3000);
  }

  async stop(reason: "cap_reached" | "user" | "error" = "user"): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
    if (this.workerInterval) clearInterval(this.workerInterval);
    this.snapshotInterval = null;
    this.workerInterval = null;
    this.activeAgents = 0;
    this.emit({
      type: "session.stopped",
      reason,
      at: new Date().toISOString(),
    });
  }

  pause(): void {
    this.paused = true;
    this.emit({
      type: "session.paused",
      sessionId: this.sessionId,
      at: new Date().toISOString(),
    });
  }

  resume(): void {
    this.paused = false;
    this.emit({
      type: "session.resumed",
      sessionId: this.sessionId,
      at: new Date().toISOString(),
    });
  }

  getSnapshot(): BurnSnapshot {
    const cap = this.config
      ? buildCapProgress(this.config, {
          tokens: this.tokens,
          costCents: this.costCents,
        })
      : { type: "percent" as const, target: 100, current: 0, remaining: 100 };

    return {
      sessionId: this.sessionId,
      status: this.running ? (this.paused ? "paused" : "burning") : "stopped",
      config: this.config ?? undefined,
      session: {
        tokens: this.tokens,
        costCents: this.costCents,
        tokensPerSec: this.computeTokensPerSec(),
      },
      cap,
      activeAgents: this.activeAgents,
      targetConcurrency: this.concurrency,
      at: new Date().toISOString(),
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  private spawnAgent(): void {
    this.workerId += 1;
    this.activeAgents += 1;
    const agentId = `bc-mock-${this.workerId.toString().padStart(4, "0")}`;
    const at = new Date().toISOString();
    this.emit({ type: "agent.spawned", agentId, workerId: this.workerId, model: "composer-2.5", at });
  }

  private simulateRun(): void {
    const agentId = `bc-mock-${this.workerId.toString().padStart(4, "0")}`;
    const runId = `run-mock-${Date.now()}`;
    const addedTokens = 25_000 + Math.floor(Math.random() * 50_000);
    const addedCost = 5 + Math.floor(Math.random() * 15);
    const at = new Date().toISOString();

    this.emit({
      type: "run.started",
      agentId,
      workerId: this.workerId,
      runId,
      model: "composer-2.5",
      at,
    });

    this.tokens += addedTokens;
    this.costCents += addedCost;
    this.completedRuns += 1;
    this.tokenHistory.push({ at: Date.now(), tokens: this.tokens });

    this.emit({
      type: "run.completed",
      agentId,
      workerId: this.workerId,
      runId,
      usage: { ...EMPTY_USAGE, totalTokens: addedTokens, outputTokens: addedTokens },
      durationMs: 1500 + Math.floor(Math.random() * 2000),
      at,
    });
  }

  private emitSnapshot(account?: BurnSnapshot["account"]): void {
    if (!this.config) return;
    this.emit({
      type: "usage.snapshot",
      session: {
        tokens: this.tokens,
        costCents: this.costCents,
        tokensPerSec: this.computeTokensPerSec(),
      },
      account,
      cap: buildCapProgress(this.config, {
        tokens: this.tokens,
        costCents: this.costCents,
      }),
      activeAgents: this.activeAgents,
      at: new Date().toISOString(),
    });
  }

  private computeTokensPerSec(): number {
    const now = Date.now();
    const recent = this.tokenHistory.filter((entry) => now - entry.at <= 10_000);
    if (recent.length < 2) return 0;
    const deltaTokens = recent[recent.length - 1]!.tokens - recent[0]!.tokens;
    const deltaMs = recent[recent.length - 1]!.at - recent[0]!.at;
    if (deltaMs <= 0) return 0;
    return Math.round((deltaTokens / deltaMs) * 1000);
  }

  private emit(event: BurnEvent): void {
    this.onEvent?.(event);
  }
}
