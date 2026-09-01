# `@cursor-throwaway/burn-engine` — Track 2

Orchestration layer from DESIGN.md §5. No HTTP, no SSE, no vendor SDK — it
emits `BurnEvent`s through a callback and Track 3 fans them out.

## Run it

Requires Node 23.6+ (native TypeScript type stripping). No install step.

```bash
node --test test/*.test.ts   # 27 tests
node demo/demo.ts            # scripted ~2min session
node demo/demo.ts --seed 7 --cap 30 --seconds 60
```

## Layout

| File | Role |
|------|------|
| `orchestrator.ts` | Session lifecycle, cap enforcement, control loop |
| `pool-manager.ts` | Keeps live workers tracking the concurrency target |
| `agent-worker.ts` | One agent slot: run → follow-ups → recycle |
| `concurrency.ts` | §6.1 adaptive controller (×0.7 on 429, +2 after 60s clean) |
| `usage-aggregator.ts` | Session token/cost totals + sliding-window burn rate |
| `strategy.ts` | §6.3 model ranking and round-robin selection |
| `task-source.ts` | Where workers get work — the pluggable slot |
| `backend.ts` | The `AgentBackend` seam |
| `simulated-backend.ts` | Seeded simulator used by the demo |

## The backend seam

Everything above `backend.ts` is provider-agnostic. To change what executes
runs, implement `AgentBackend` (five methods) and pass it to the orchestrator:

```ts
const orch = new BurnOrchestrator({ backend: new SimulatedBackend({ seed: 42 }) });
await orch.start(apiKey, config, onEvent);
const reason = await orch.waitUntilStopped();
```

`SimulatedBackend` is seeded, so a given seed replays the same session — same
run latencies, same 429 timings, same cap trip. Use `rateLimitWindows` to
script a rate-limit storm at a known second.

## Notes for integration (Track 3)

- `src/types.ts` and `src/events.ts` are **local mirrors** of `packages/shared`,
  which had not landed when this was written. Delete both and re-point
  `index.ts` at `@cursor-throwaway/shared`; the shapes were copied from
  DESIGN.md §7.1/§8 so the swap is mechanical.
- `start()` resolves when the pool is *running*, not when the session ends —
  await `waitUntilStopped()` for the terminal reason. This is what lets an HTTP
  handler return 200 immediately.
- Dollar and token caps are enforced on the usage path (immediately); percent
  caps depend on `getAccountUsage()` and are checked on the control-loop tick.
- A percent cap with no account data will **never** trip. The orchestrator
  emits `error: "account usage unavailable"` rather than treating missing data
  as 0% — see the §7.3 fallback banner.

## Known issue

`ConcurrencyController` doubles its backoff per 429, but a storm delivers one
429 *per worker* at once, so 20 workers jump the backoff to its 60s ceiling in
a single wave and the pool sits idle for a full minute. Visible in the demo
around t+20s. Fix is to debounce: treat 429s inside one backoff window as a
single wave. Not done here — flagged rather than silently tuned.
