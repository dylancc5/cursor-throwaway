/**
 * Model selection (DESIGN.md §6.3).
 *
 * Ranks the models the backend advertises according to the session's
 * `modelPreference`, and round-robins across the ranked set so a single
 * blocked or degraded model cannot stall the whole pool.
 */
import type { ModelInfo } from "./backend.ts";
import type { BurnConfig } from "./types.ts";

export class BurnStrategy {
  readonly #config: BurnConfig;
  #ranked: ModelInfo[] = [];
  #cursor = 0;
  readonly #blocked = new Set<string>();

  constructor(config: BurnConfig) {
    this.#config = config;
  }

  /** Call once at session start with `backend.listModels()`. */
  rank(models: ModelInfo[]): ModelInfo[] {
    const byPool = (pool: ModelInfo["pool"]) => models.filter((m) => m.pool === pool);
    const byCostDesc = (list: ModelInfo[]) => list.slice().sort((a, b) => b.costWeight - a.costWeight);

    switch (this.#config.modelPreference) {
      case "other_models":
        this.#ranked = [...byCostDesc(byPool("other_models")), ...byCostDesc(byPool("cursor_models"))];
        break;
      case "cursor_models":
        this.#ranked = [...byCostDesc(byPool("cursor_models")), ...byCostDesc(byPool("other_models"))];
        break;
      case "fastest_pool":
      default:
        // Highest cost weight first regardless of pool — depletes whichever
        // pool the priciest model draws from fastest.
        this.#ranked = byCostDesc(models);
        break;
    }
    this.#cursor = 0;
    return this.#ranked.slice();
  }

  get ranked(): ModelInfo[] {
    return this.#ranked.slice();
  }

  /** Round-robin over the ranked list, skipping models marked blocked. */
  selectModel(): string {
    const available = this.#ranked.filter((m) => !this.#blocked.has(m.id));
    const pool = available.length > 0 ? available : this.#ranked;
    if (pool.length === 0) throw new Error("BurnStrategy.rank() must be called before selectModel()");
    const model = pool[this.#cursor % pool.length]!;
    this.#cursor += 1;
    return model.id;
  }

  /** Take a model out of rotation after a non-retryable failure. */
  blockModel(modelId: string): void {
    this.#blocked.add(modelId);
  }

  get blockedModels(): string[] {
    return [...this.#blocked];
  }
}
