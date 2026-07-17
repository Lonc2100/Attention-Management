# PRD v0.7.2 — Collector Reliability Hotfix

## Goal

Keep real Windows activity collection available for long-running self-use even when ActivityWatch emits sustained logs, a data-plane request stalls, a watcher exits, or local disk space becomes unsafe.

## Confirmed Incident Facts

- The bundled ActivityWatch v0.13.2 process writes every log record to stdout and to its own file.
- The Electron parent creates a stdout pipe but does not consume it. A full pipe can block the child while its process and listening socket remain visible.
- Two real incidents show `SQLITE_FULL` followed by a permanently poisoned datastore lock.
- The home dashboard repeatedly submits 366 daily time periods to ActivityWatch. This creates avoidable server work and log volume.
- Existing tests pass but do not cover sustained stdout, half-alive servers, disk pressure, stale watcher events, or controlled recovery.

## Requirements

### R1 — Non-blocking child process I/O

- ActivityWatch stdout must never be connected to an unread pipe.
- Spawn failures and exits must be observed without crashing the Electron main process.
- ActivityWatch's own file logs remain the durable diagnostic source.

### R2 — Bounded historical work-activity queries

- No ActivityWatch query request may contain more than 31 daily periods.
- Dates before the selected window/AFK bucket creation time must be represented as known zero activity without querying the server.
- Completed historical daily facts must be stored in a disposable derived cache. Normal refreshes query today only; missing historical dates are backfilled in bounded batches.
- Cache corruption or absence must degrade to re-computation, never damage user records or raw ActivityWatch buckets.

### R3 — Honest data-plane health

- Health must verify both bucket reads and the freshness of current-window and AFK buckets while tracking is enabled.
- `/info` success alone must not produce a green collector status.
- Diagnostics must expose disk space and automatic-recovery state in user-readable language.

### R4 — Controlled self-recovery

- Three consecutive unhealthy data-plane samples may trigger recovery only when the server is owned by this application and free disk is above the critical threshold.
- Recovery must stop owned watchers and server, wait for exit, restart server first, then watchers, and verify the data plane.
- Attempts use bounded backoff and cannot become a restart loop.
- An external ActivityWatch instance must never be killed automatically.
- Critical disk pressure must suppress restart attempts and clearly request space recovery.

### R5 — Startup and ongoing lifecycle

- The main window and tray must not wait up to 20 seconds for ActivityWatch startup.
- Monitoring starts after application readiness and stops during application quit.
- Pausing tracking still stops only application-owned watchers and is disclosed as that ownership boundary.

### R6 — Upstream version decision

- ActivityWatch v0.14.0b1 must be evaluated in an isolated smoke test.
- The shipped runtime remains v0.13.2 unless the beta passes compatibility, data-path, startup, query, and watcher smoke checks. A pre-release must not be adopted solely because it contains the upstream disk-full fix.

## Out of Scope

- UI redesign or new dashboard metrics.
- Deleting or rewriting ActivityWatch raw history or persisted watcher queues.
- Cloud telemetry, crash upload, automatic updates, macOS, code signing, or employee monitoring.
- Claiming that automated tests replace a real multi-day soak.

## Acceptance Criteria

- [x] A child emitting more than 1 MB of stdout cannot block because no unread stdout pipe exists.
- [x] A 366-day request is split into batches of at most 31 days and a second refresh only re-queries mutable/missing dates.
- [x] Three consecutive half-alive samples produce one owned-process recovery attempt; cooldown suppresses repeats.
- [x] Disk below 2 GB prevents restart and diagnostics show a critical-space reason.
- [x] Stale watcher buckets are unhealthy while tracking; healthy fresh buckets reset failure state.
- [x] External ActivityWatch ownership produces a degraded status without process termination.
- [x] Unit, integration, typecheck, build, two E2E rounds, packaged smoke, real upgrade, data retention, and autostart checks pass.
- [x] An accelerated reliability soak runs for at least 15 minutes with repeated refreshes and no collector stall; a real multi-day soak remains a documented follow-up.
- [x] v0.14.0b1 evaluation is recorded with a keep/upgrade decision and evidence.
