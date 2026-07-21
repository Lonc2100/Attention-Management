# Attention Management Architecture

## Purpose

Attention Management is a Windows, local-first Electron application. It observes foreground-window and AFK events through a bundled ActivityWatch runtime, attributes trustworthy Codex activity to projects, stores user decisions locally, and renders dashboards and a floating focus widget.

This document describes the architecture that exists and the direction for incremental extraction. It is not permission for a big-bang rewrite.

## Process Boundaries

```text
ActivityWatch / Codex / Windows / File System
                    |
             Main-process Providers
                    |
Repositories -> Application Services -> Electron Runtime / IPC
                                           |
                                  typed preload bridge
                                           |
                                      Renderer UI

Shared types and pure rules may be consumed by every TypeScript process.
They may not depend on any process or platform implementation.
```

## Current Source Map

| Path | Responsibility | Allowed dependencies |
| --- | --- | --- |
| `src/shared` | IPC contracts, domain types, pure time and insight rules | Other shared modules only |
| `src/main` | Electron lifecycle, local persistence, ActivityWatch/Codex integration, orchestration and IPC registration | Shared plus Node/Electron and external adapters |
| `src/preload` | Typed `contextBridge` adapter | Electron IPC and shared contracts |
| `src/renderer` | React pages, charts, corrections and floating widget | React, renderer modules and shared types/pure rules |

## Target Main-process Layers

New extraction work uses these folders when a responsibility is large enough to justify a boundary:

```text
src/main/
├─ providers/      # ActivityWatch, Codex, Windows automation and OS commands
├─ repositories/   # Local JSON/cache persistence only
├─ services/       # Product rules and use cases; no Electron window code
├─ ipc/            # Input validation and service invocation only
├─ runtime/        # Collector supervision, timers and long-lived orchestration
└─ bootstrap/      # Electron windows, tray, composition and dependency wiring
```

Existing top-level files are migrated only while changing that responsibility and only after behavior is covered by tests.

## Fixed Route

```text
Shared Types / Pure Rules
          -> Providers + Repositories
          -> Application Services
          -> Electron Runtime / IPC
          -> Preload Bridge
          -> Renderer UI
```

- Providers isolate external processes, APIs, Windows automation and commands.
- Repositories read and write state; they do not classify activity or manage windows.
- Services own product behavior and may use providers, repositories and shared rules.
- IPC validates input and calls a service/runtime entrypoint.
- Renderer UI invokes the typed preload API and never talks to ActivityWatch directly.

## Security and Privacy Invariants

- Browser windows keep `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.
- No keyboard正文、录屏、screenshots or secret capture is introduced by architecture work.
- Raw local evidence remains local; AI receives aggregated summaries unless a user explicitly changes the privacy scope.
- Harness validation never reads or mutates real user data.

## Known Hotspots

- `src/main/index.ts` is the current composition root and also contains IPC/window/tray behavior. Extract IPC and window/runtime responsibilities incrementally.
- `src/main/activitywatch.ts` combines API queries, workday reads, health and collector lifecycle. Extract client/query/supervisor boundaries incrementally.
- `src/shared/contracts.ts` is the single IPC contract surface. Split by domain only when a change needs it; keep a stable public barrel.
- `src/main/store.ts` is adequate for a single-user local product but must not accumulate unrelated business rules.

## Verification Gates

- `npm run context:check` — the engineering map is present and points to Trellis.
- `npm run lint:arch` — process and future main-layer imports respect boundaries.
- `npm run test:structure` — required Electron security and Harness entrypoints exist.
- `npm run verify` — Harness gates, typecheck, unit tests and production build.
