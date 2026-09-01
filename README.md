# cursor-throwaway

A web app that burns through Cursor Pro included usage as fast as possible using parallel cloud agents, with live observability.

## Design doc

Read **[docs/DESIGN.md](docs/DESIGN.md)** for the full architecture, API spec, and parallel build tracks.

## Parallel build tracks

Pick one track and stay in your lane to avoid merge conflicts:

| Track | Package(s) | Focus |
|-------|------------|-------|
| **Track 1** | `packages/web` | Next.js UI, login popup, live SSE dashboard |
| **Track 2** | `packages/burn-engine` | Cloud agent orchestrator, burn strategy, concurrency |
| **Track 3** | `packages/shared`, `packages/api` | Shared contracts, Hono API, SDK auth bridge, SSE hub |

**Day 1 blocker:** Track 3 ships `packages/shared` first. Other tracks mock against those types until integration.

## Getting started

Implementation has not started yet. See the design doc for the monorepo layout and integration milestones.
