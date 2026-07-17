# TEST_PLAN (v0.7.2)

## 1. Scope

- PRD: `.trellis/tasks/07-17-v0-7-2-collector-reliability/prd.md`
- In scope: child I/O, bounded history queries, derived cache, data health, disk guard, restart policy, startup lifecycle, diagnostics and installed reliability.
- Out of scope: UI redesign, cloud telemetry, code signing, macOS and destructive raw-data recovery.

## 2. Release Gate

1. All planned P0 cases pass.
2. Unit and integration suites pass twice after code freeze.
3. Two Electron E2E rounds pass.
4. Packaged smoke and real upgrade pass.
5. Existing schema, records, Codex context and autostart survive upgrade.
6. Accelerated 15-minute soak does not lose API availability.

## 3. Cases

### Unit (A)

- UT-72-01: no unread child stdout pipe; error and exit are observed.
- UT-72-02: 366 dates produce requests of at most 31 periods.
- UT-72-03: pre-bucket dates do not reach the query endpoint.
- UT-72-04: cache corruption is ignored and historical facts are reused.
- UT-72-05: recovery needs three failures and applies backoff.
- UT-72-06: critical disk and external ownership suppress restart.
- UT-72-07: fresh bucket timestamps pass; stale/missing buckets fail.

### Integration (A)

- IT-72-01: real ActivityWatch remains responsive during repeated dashboard refreshes.
- IT-72-02: owned half-alive process is replaced once and becomes responsive.
- IT-72-03: diagnostics report disk and recovery state.
- IT-72-04: isolated ActivityWatch v0.14.0b1 startup/query/watcher compatibility smoke.

### E2E (A + H)

- E2E-72-01: startup UI appears without waiting for collector timeout.
- E2E-72-02: pause/resume and Codex attribution regressions remain green.
- E2E-72-03: package, install, upgrade, retention and autostart.
- E2E-72-04: 15-minute accelerated soak; multi-day human soak remains follow-up.

## 4. Execution Order

Unit -> Integration -> E2E -> package -> real upgrade -> soak. Up to three root-cause repair rounds per failing gate.
