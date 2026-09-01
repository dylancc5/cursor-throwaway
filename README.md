# cursor-throwaway

A web app that burns through Cursor Pro included usage as fast as possible using parallel cloud agents, with live observability.

## Design doc

Read **[docs/DESIGN.md](docs/DESIGN.md)** for the full architecture, API spec, and parallel build tracks.

Track 3 swarm plan: **[docs/TRACK3_SWARM.md](docs/TRACK3_SWARM.md)**

## Track 3 (Platform API) — implemented

| Package | Status |
|---------|--------|
| `@cursor-burner/shared` | Zod schemas, `BurnEvent` union, `BurnEngine` interface |
| `@cursor-burner/api` | Hono server, SDK login, SSE, session store, dashboard poller |

### Quick start

```bash
npm install
npm run build
cp .env.example .env
npm run dev:api
```

API runs at `http://localhost:3001`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Start Cursor SDK login |
| `GET` | `/auth/status/:sessionId` | Poll auth status |
| `POST` | `/auth/logout` | Clear session |
| `POST` | `/burn/start` | Start burn (mock engine until Track 2) |
| `POST` | `/burn/stop` | Stop burn |
| `POST` | `/burn/pause` | Pause burn |
| `GET` | `/burn/status` | Session status |
| `GET` | `/burn/events` | SSE event stream |
| `GET` | `/health` | Health check |

### Dashboard poller spike

```bash
CURSOR_API_KEY=your-key npm run spike:dashboard -w @cursor-burner/api
```

### Parallel build tracks

| Track | Package(s) | Focus |
|-------|------------|-------|
| **Track 1** | `packages/web` | Next.js UI (not started) |
| **Track 2** | `packages/burn-engine` | Cloud agent orchestrator (not started) |
| **Track 3** | `packages/shared`, `packages/api` | **Done** — contracts + platform API |

Track 2 integrates by swapping `MockBurnEngine` in `packages/api/src/burn-controller.ts`.
