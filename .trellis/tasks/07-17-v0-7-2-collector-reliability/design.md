# Design — v0.7.2 Collector Reliability Hotfix

## Architecture

The existing `ActivityWatchManager` remains the single owner of the bundled server and watcher lifecycle. The hotfix adds three explicit boundaries:

1. **Process boundary** — spawn ActivityWatch with stdin/stdout ignored and stderr consumed; record exit/error state.
2. **Health/recovery boundary** — sample data-plane health and disk capacity, then pass facts through a deterministic recovery policy.
3. **Historical cache boundary** — store disposable daily active-time facts outside the user-record schema and query only missing/mutable dates in bounded batches.

No second raw activity store is introduced. ActivityWatch remains the source of truth; the cache can always be discarded and rebuilt.

## Process Contract

- `stdio = ['ignore', 'ignore', 'pipe']` because ActivityWatch already writes durable files and stdout must not backpressure the child.
- Every child has `error` and `exit` observers.
- `owned` is the only authority for automatic termination/restart. Port ownership or process-name scans never grant kill authority.
- Graceful termination waits briefly; a still-running owned child receives one forced termination through Node's child-process API.

## Health Contract

`dataHealth()` performs a real bucket request and accepts either `metadata.end` or legacy `last_updated`. While tracking is enabled, current-window freshness is capped at 120 seconds. AFK freshness is capped at 300 seconds because the watcher can legitimately delay the next event until the normal idle transition completes. A startup grace period prevents false alarms. It reports structured reasons:

- `healthy`
- `server-unreachable`
- `data-plane-failed`
- `missing-bucket`
- `stale-window`
- `stale-afk`

The public diagnostics view converts these facts to concise Chinese text; internal errors and raw titles are not exposed.

## Recovery Policy

The policy is pure and unit-tested. Inputs are current time, health, disk bytes and ownership. State is consecutive failures, attempt count and next allowed attempt.

- Healthy: reset failures and attempt count.
- Fewer than three failures: degraded, no mutation.
- Critical disk (`< 2 GiB`): blocked, no restart.
- Not owned: degraded, no restart.
- Eligible: restart once and apply cooldown `[60s, 5m, 15m]`, capped at 15 minutes.

After restart, server readiness and fresh data are verified. Failed recovery stays degraded and waits for the next cooldown.

## Work-Activity Cache

File: `<userData>/work-activity-facts-v1.json`.

Shape:

```json
{
  "version": 1,
  "facts": {
    "2026-07-17": { "activeSeconds": 1234, "observedSeconds": 1500, "available": true }
  }
}
```

- Writes use a temporary sibling followed by atomic rename.
- Invalid cache content is ignored.
- Historical cached dates are reused; today is always mutable.
- Missing dates are queried sequentially in batches of at most 31 periods.
- Dates before both required bucket sources exist are returned as zero without a server query.

## Startup

Window, widget and tray creation no longer await the collector. Collector startup runs asynchronously; the UI truthfully begins disconnected and updates when data arrives. Monitoring begins after the startup attempt completes.

## Compatibility and Rollback

- User data schema remains v6.
- Raw ActivityWatch data and queues are untouched.
- Removing the derived cache is safe but is not part of automated rollback.
- Rolling back to v0.7.1 ignores the extra cache file.
- The bundled upstream runtime stays v0.13.2 by default; v0.14.0b1 evaluation is isolated.
