import type {
  AccountUsage,
  AgentWorkerState,
  BurnConfig,
  BurnEvent,
  BurnSnapshot,
  CapStatus,
  SessionUsage,
} from '@cursor-throwaway/shared';

export interface MockEngineOptions {
  config: BurnConfig;
  onEvent: (event: BurnEvent) => void;
}

export class MockBurnEngine {
  private config: BurnConfig;
  private onEvent: (event: BurnEvent) => void;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private sessionId: string;
  private activeWorkers: Map<number, AgentWorkerState> = new Map();
  private concurrency: number;
  private totalTokens: number = 0;
  private totalCostCents: number = 0;
  private currentBurnRate: number = 0;
  private startedAt: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private workerTimers: Map<number, NodeJS.Timeout> = new Map();

  // Baseline account stats
  private accountTotalPercent: number = 42.5;
  private accountAutoPercent: number = 28.0;
  private accountApiPercent: number = 14.5;
  private initialCapBase: number = 0;

  constructor(options: MockEngineOptions) {
    this.config = options.config;
    this.onEvent = options.onEvent;
    this.sessionId = `mock-session-${Date.now().toString(36)}`;
    this.concurrency = options.config.initialConcurrency || 20;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startedAt = Date.now();
    this.totalTokens = 0;
    this.totalCostCents = 0;
    this.activeWorkers.clear();

    const now = new Date().toISOString();
    this.onEvent({
      type: 'session.started',
      sessionId: this.sessionId,
      config: this.config,
      at: now,
    });

    // Initialize workers
    for (let i = 1; i <= this.concurrency; i++) {
      this.spawnWorker(i);
    }

    // Regular snapshot timer (every 2s)
    this.snapshotTimer = setInterval(() => {
      if (!this.isRunning || this.isPaused) return;
      this.emitSnapshot();
      this.checkCap();
    }, 2000);

    // Concurrency adjustment simulation (occasional random tune)
    this.timer = setInterval(() => {
      if (!this.isRunning || this.isPaused) return;
      if (Math.random() < 0.15) {
        this.simulateRateLimitOrScale();
      }
    }, 12000);
  }

  public stop(reason: 'user' | 'cap_reached' | 'error' = 'user') {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = false;

    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.timer) clearInterval(this.timer);
    this.workerTimers.forEach((t) => clearTimeout(t));
    this.workerTimers.clear();

    const now = new Date().toISOString();
    this.onEvent({
      type: 'session.stopped',
      sessionId: this.sessionId,
      reason,
      at: now,
    });
  }

  public pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    const now = new Date().toISOString();
    this.onEvent({
      type: 'session.paused',
      sessionId: this.sessionId,
      at: now,
    });
  }

  public resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    const now = new Date().toISOString();
    this.onEvent({
      type: 'session.resumed',
      sessionId: this.sessionId,
      at: now,
    });
  }

  public getSnapshot(): BurnSnapshot {
    return {
      sessionId: this.sessionId,
      status: !this.isRunning ? 'stopped' : this.isPaused ? 'paused' : 'running',
      session: this.getSessionUsage(),
      account: this.getAccountUsage(),
      cap: this.getCapStatus(),
      activeAgents: Array.from(this.activeWorkers.values()).filter(
        (w) => w.status === 'working' || w.status === 'spawning'
      ).length,
      targetConcurrency: this.concurrency,
      at: new Date().toISOString(),
    };
  }

  private spawnWorker(workerId: number) {
    if (!this.isRunning) return;
    const agentId = `ag-mock-${workerId.toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 6)}`;
    const model = this.selectModel();

    const workerState: AgentWorkerState = {
      workerId,
      agentId,
      status: 'spawning',
      model,
      turnsCompleted: 0,
      totalTokens: 0,
      lastActiveAt: new Date().toISOString(),
    };

    this.activeWorkers.set(workerId, workerState);

    this.onEvent({
      type: 'agent.spawned',
      agentId,
      workerId,
      model,
      at: new Date().toISOString(),
    });

    // Worker starts executing turns
    const delay = Math.random() * 800 + 200;
    const timeout = setTimeout(() => {
      this.executeWorkerTurn(workerId);
    }, delay);
    this.workerTimers.set(workerId, timeout);
  }

  private executeWorkerTurn(workerId: number) {
    if (!this.isRunning || this.isPaused) return;
    const worker = this.activeWorkers.get(workerId);
    if (!worker) return;

    worker.status = 'working';
    const runId = `run-${Math.random().toString(36).substring(2, 9)}`;
    worker.currentRunId = runId;
    worker.lastActiveAt = new Date().toISOString();

    this.onEvent({
      type: 'run.started',
      agentId: worker.agentId,
      workerId,
      runId,
      model: worker.model,
      at: new Date().toISOString(),
    });

    // Simulate multi-turn inference latency (1.2s to 3.5s)
    const turnDurationMs = Math.floor(Math.random() * 2000 + 1200);

    const timeout = setTimeout(() => {
      if (!this.isRunning || this.isPaused) return;

      // Generate realistic tokens
      const promptTokens = Math.floor(Math.random() * 800 + 1200);
      const completionTokens = Math.floor(Math.random() * 3200 + 2400);
      const turnTokens = promptTokens + completionTokens;

      // Approximate Opus / Composer / Claude cost in cents
      const costCents = Math.round((turnTokens / 1000) * 0.45);

      this.totalTokens += turnTokens;
      this.totalCostCents += costCents;

      worker.turnsCompleted += 1;
      worker.totalTokens += turnTokens;
      worker.lastActiveAt = new Date().toISOString();

      this.onEvent({
        type: 'run.completed',
        agentId: worker.agentId,
        workerId,
        runId,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: turnTokens,
          costCents,
        },
        durationMs: turnDurationMs,
        at: new Date().toISOString(),
      });

      // Recycle agent after 5 turns (DESIGN.md §6.4)
      if (worker.turnsCompleted >= 5) {
        this.onEvent({
          type: 'agent.recycled',
          agentId: worker.agentId,
          workerId,
          turnsCompleted: worker.turnsCompleted,
          at: new Date().toISOString(),
        });
        const recycleTimeout = setTimeout(() => {
          this.spawnWorker(workerId);
        }, 500);
        this.workerTimers.set(workerId, recycleTimeout);
      } else {
        // Next follow-up turn
        const nextTimeout = setTimeout(() => {
          this.executeWorkerTurn(workerId);
        }, Math.random() * 400 + 300);
        this.workerTimers.set(workerId, nextTimeout);
      }
    }, turnDurationMs);

    this.workerTimers.set(workerId, timeout);
  }

  private simulateRateLimitOrScale() {
    const isRateLimit = Math.random() < 0.4;
    if (isRateLimit && this.concurrency > 8) {
      const from = this.concurrency;
      const to = Math.max(6, Math.floor(from * 0.75));
      this.concurrency = to;

      this.onEvent({
        type: 'rate_limit',
        retryInMs: 3000,
        concurrency: to,
        at: new Date().toISOString(),
      });

      this.onEvent({
        type: 'concurrency.adjusted',
        from,
        to,
        reason: 'Rate limit 429 backoff detected; scaling down worker pool',
        at: new Date().toISOString(),
      });
    } else if (this.concurrency < (this.config.initialConcurrency || 25)) {
      const from = this.concurrency;
      const to = Math.min(from + 3, this.config.initialConcurrency || 25);
      this.concurrency = to;

      this.onEvent({
        type: 'concurrency.adjusted',
        from,
        to,
        reason: 'Clean period sustained without 429; scaling up worker pool',
        at: new Date().toISOString(),
      });

      // Spawn missing workers
      for (let i = from + 1; i <= to; i++) {
        this.spawnWorker(i);
      }
    }
  }

  private selectModel(): string {
    const pref = this.config.modelPreference;
    if (pref === 'cursor_models') return 'composer-2.5';
    if (pref === 'other_models') return 'claude-3-7-sonnet';
    // fastest pool rotates
    const models = ['claude-3-7-sonnet', 'composer-2.5', 'claude-3-5-sonnet'];
    return models[Math.floor(Math.random() * models.length)];
  }

  private getSessionUsage(): SessionUsage {
    const elapsedSec = Math.max(1, (Date.now() - this.startedAt) / 1000);
    this.currentBurnRate = Math.round(this.totalTokens / elapsedSec);
    return {
      tokens: this.totalTokens,
      costCents: this.totalCostCents,
      tokensPerSec: this.isRunning && !this.isPaused ? this.currentBurnRate : 0,
    };
  }

  private getAccountUsage(): AccountUsage {
    // Dynamic account percentage calculation as tokens burn
    const percentBurnedIncrement = (this.totalTokens / 500_000) * 1.2;
    const total = Math.min(100, this.accountTotalPercent + percentBurnedIncrement);
    const auto = Math.min(100, this.accountAutoPercent + percentBurnedIncrement * 0.7);
    const api = Math.min(100, this.accountApiPercent + percentBurnedIncrement * 0.3);

    return {
      totalPercent: Number(total.toFixed(1)),
      autoPercent: Number(auto.toFixed(1)),
      apiPercent: Number(api.toFixed(1)),
      includedSpendCents: 2000,
      limitCents: 5000,
    };
  }

  private getCapStatus(): CapStatus {
    const cap = this.config.cap;
    let current = 0;
    let remaining = 0;

    if (cap.type === 'percent') {
      const account = this.getAccountUsage();
      current = account.totalPercent;
      remaining = Math.max(0, cap.value - current);
    } else if (cap.type === 'dollars') {
      current = this.totalCostCents / 100;
      remaining = Math.max(0, cap.value - current);
    } else {
      // session_tokens
      current = this.totalTokens;
      remaining = Math.max(0, cap.value - current);
    }

    return {
      type: cap.type,
      target: cap.value,
      current: Number(current.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
    };
  }

  private checkCap() {
    const capStatus = this.getCapStatus();
    if (capStatus.current >= capStatus.target) {
      this.stop('cap_reached');
    }
  }

  private emitSnapshot() {
    this.onEvent({
      type: 'usage.snapshot',
      sessionId: this.sessionId,
      session: this.getSessionUsage(),
      account: this.getAccountUsage(),
      cap: this.getCapStatus(),
      activeAgents: Array.from(this.activeWorkers.values()).filter(
        (w) => w.status === 'working' || w.status === 'spawning'
      ).length,
      at: new Date().toISOString(),
    });
  }
}
