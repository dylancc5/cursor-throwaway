import type {
  AccountUsage,
  BurnConfig,
  BurnEngine,
  BurnEvent,
} from "@cursor-burner/shared";
import { MockBurnEngine } from "./burn/mock-burn-engine.js";
// Track 2: import { BurnOrchestrator } from "@cursor-burner/burn-engine";
import type { EventHub } from "./sse/event-hub.js";
import { buildCapProgress, isCapReached } from "./usage/cap-checker.js";
import { fetchCurrentPeriodUsage } from "./usage/dashboard-poller.js";
import type { SessionStore } from "./session-store.js";

export class BurnController {
  private engine: BurnEngine = new MockBurnEngine();
  private accountUsage: AccountUsage | null = null;
  private accountUsageAvailable = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private activeSessionId: string | null = null;

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly eventHub: EventHub,
  ) {}

  setEngine(engine: BurnEngine): void {
    this.engine = engine;
  }

  async start(sessionId: string, config: BurnConfig): Promise<void> {
    const apiKey = this.sessionStore.getApiKey(sessionId);
    if (!apiKey) {
      throw new Error("Not authenticated");
    }

    this.sessionStore.setBurnConfig(sessionId, config);
    this.sessionStore.setStatus(sessionId, "burning");
    this.activeSessionId = sessionId;

    this.accountUsage = await fetchCurrentPeriodUsage(apiKey);
    this.accountUsageAvailable = this.accountUsage !== null;

    const onEvent = (event: BurnEvent) => {
      this.eventHub.publish(sessionId, event);
      if (event.type === "usage.snapshot") {
        this.checkCap(sessionId, config, event);
      }
    };

    this.pollInterval = setInterval(async () => {
      if (this.activeSessionId !== sessionId) return;
      const refreshed = await fetchCurrentPeriodUsage(apiKey);
      if (refreshed) {
        this.accountUsage = refreshed;
        this.accountUsageAvailable = true;
      }
      this.publishSnapshot(sessionId, config);
    }, 5000);

    await this.engine.start(apiKey, sessionId, config, onEvent);
  }

  async stop(sessionId: string): Promise<void> {
    await this.stopWithReason(sessionId, "user");
  }

  private async stopWithReason(
    sessionId: string,
    reason: "cap_reached" | "user" | "error",
  ): Promise<void> {
    if (this.engine instanceof MockBurnEngine) {
      await this.engine.stop(reason);
    } else {
      await this.engine.stop();
      this.eventHub.publish(sessionId, {
        type: "session.stopped",
        reason,
        at: new Date().toISOString(),
      });
    }
    this.clearPolling();
    this.sessionStore.setStatus(sessionId, "stopped");
    this.activeSessionId = null;
  }

  pause(): void {
    this.engine.pause();
    if (this.activeSessionId) {
      this.sessionStore.setStatus(this.activeSessionId, "paused");
    }
  }

  resume(): void {
    this.engine.resume();
    if (this.activeSessionId) {
      this.sessionStore.setStatus(this.activeSessionId, "burning");
    }
  }

  getStatus(sessionId: string) {
    const record = this.sessionStore.get(sessionId);
    const snapshot = this.engine.getSnapshot();
    return {
      sessionId,
      status: record?.status ?? "idle",
      email: record?.email,
      config: record?.config,
      accountUsageAvailable: this.accountUsageAvailable,
      snapshot: {
        tokens: snapshot.session.tokens,
        costCents: snapshot.session.costCents,
        tokensPerSec: snapshot.session.tokensPerSec,
        activeAgents: snapshot.session.activeAgents,
        completedRuns: snapshot.session.completedRuns,
        concurrency: snapshot.concurrency,
      },
    };
  }

  isAccountUsageAvailable(): boolean {
    return this.accountUsageAvailable;
  }

  private publishSnapshot(sessionId: string, config: BurnConfig): void {
    const snapshot = this.engine.getSnapshot();
    this.eventHub.publish(sessionId, {
      type: "usage.snapshot",
      session: {
        tokens: snapshot.session.tokens,
        costCents: snapshot.session.costCents,
        tokensPerSec: snapshot.session.tokensPerSec,
      },
      account: this.accountUsage ?? undefined,
      cap: buildCapProgress(
        config,
        {
          tokens: snapshot.session.tokens,
          costCents: snapshot.session.costCents,
        },
        this.accountUsage,
      ),
      activeAgents: snapshot.session.activeAgents,
      at: new Date().toISOString(),
    });
  }

  private checkCap(
    sessionId: string,
    config: BurnConfig,
    event: Extract<BurnEvent, { type: "usage.snapshot" }>,
  ): void {
    const reached = isCapReached(
      config,
      {
        tokens: event.session.tokens,
        costCents: event.session.costCents,
      },
      this.accountUsage,
    );
    if (reached) {
      void this.stopWithReason(sessionId, "cap_reached");
    }
  }

  private clearPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
