# Implementation Plan — v0.7.2

## Behavior Slices

- [x] S1 Red/green: ActivityWatch child launch cannot create an unread stdout pipe; spawn error/exit is observable.
- [x] S2 Red/green: daily activity requests are capped at 31 periods and skip dates before bucket creation.
- [x] S3 Red/green: disposable historical cache reuses immutable dates and only refreshes today/missing facts.
- [x] S4 Red/green: recovery policy requires three failures, respects disk critical state, ownership and backoff.
- [x] S5 Red/green: data health rejects stale buckets and diagnostics expose disk/recovery state.
- [x] S6 Integrate non-blocking startup, periodic monitoring and shutdown cleanup.
- [x] S7 Evaluate ActivityWatch v0.14.0b1 in isolation; record decision without silently changing runtime.
- [x] S8 Run full validation, package, smoke, upgrade, retention, autostart and reliability soak.
- [ ] S9 Update PRD registry, roadmap, release notes, Trellis specs, task journal and version metadata.

## Public Interfaces Under Test

- `ActivityWatchManager.ensureStarted`, `dataHealth`, `maintain`, `diskHealth`, `stopAll`.
- `CollectorRecoveryPolicy.evaluate`.
- `WorkActivityFactsCache.resolve` with ActivityWatch query callback as a system boundary.
- IPC diagnostics and work-activity dashboard through existing Electron E2E.

## Mock Boundaries

- Mock: child process spawn, HTTP fetch, clock, disk free-space reader and cache filesystem path.
- Do not mock: recovery policy, batching, cache merge/validation, dashboard aggregation.
- E2E uses the real bundled ActivityWatch runtime and real local IPC.

## Validation Order

1. Focused unit test after each slice.
2. Full `npm test`.
3. `npm run typecheck`.
4. `npm run build`.
5. Two `npm run test:e2e` rounds.
6. Installer build and `tests/packaged-smoke.mjs`.
7. Real installed upgrade, data/schema retention and `tests/installed-autostart.mjs`.
8. Accelerated 15-minute reliability soak.

## Rollback Points

- Keep user schema at v6 and raw ActivityWatch data untouched.
- Do not adopt v0.14.0b1 unless isolated evidence is green.
- If automatic restart is unstable, retain health/disk diagnostics and disable mutation behind one internal flag before release.
