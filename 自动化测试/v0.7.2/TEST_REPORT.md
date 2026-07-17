# TEST_REPORT (v0.7.2)

## 1. Summary

- Date: 2026-07-17
- PRD: `.trellis/tasks/07-17-v0-7-2-collector-reliability/prd.md`
- Result: PASS

## 2. Commands and Results

- `npm run dist`: 73 unit/integration tests passed; 3 opt-in external Codex integration tests skipped by design; node/web typecheck and production build passed.
- `npm run test:e2e` twice after the final product-code change: 17 checks passed in each successful round.
- `node tests/packaged-smoke.mjs`: bundled ActivityWatch v0.13.2, main/widget windows and expanded diagnostics passed.
- Silent real upgrade: installer exit 0; installed `FileVersion=0.7.2`; user-data SHA-256 unchanged (`679CE7AEBB9D713663ECE92782D670696292AE0E9324BE5542F85420F199E266`).
- Retention: schema v6, 4 record days, 4 Codex context days and `launchAtLogin=true` preserved.
- `node tests/installed-autostart.mjs`: disabling removed the Windows Run value; enabling restored the installed path with `--hidden`.
- `node tests/reliability-soak.mjs`: 900,634 ms, 179 bucket samples, 60 bounded 31-day queries, maximum observed bucket age 140,108 ms, no timeout/stale failure.
- Final installer SHA-256: `C5885DC0FC5B2274574B89D6FC375F7CD892880CEA885D0F5AE6ED6B2F703011`.
- Authenticode: `NotSigned` (unchanged honest beta boundary).

## 3. Coverage

- Unit/integration: process stdio, exit/error observation, query batching, pre-bucket zeroes, cache persistence/corruption, bucket metadata compatibility, AFK transition semantics, disk thresholds, ownership and backoff.
- E2E: real ActivityWatch startup, pause/resume process counts, restart persistence, dashboard/details/widget/diagnostics and Codex context surface.
- Installed: packaged runtime, real profile retention, login startup registry and 15-minute sustained API/query sampling.

## 4. Failures and Repairs

- Initial E2E attempts were blocked by the already installed v0.7.1 half-alive process group. Only processes whose executable path belonged to this application were stopped; the new E2E-owned stack then passed.
- Non-blocking startup initially left E2E mode without its production refresh timer. E2E now performs the same refresh lifecycle at a shorter interval.
- An E2E restart assertion required a project link even when the same test had truthfully found no known project. The assertion now preserves a link only when one existed and otherwise verifies that restart does not invent one.
- The first soak failed at 689 seconds when AFK metadata age reached 123 seconds. Watcher logs proved a normal delayed AFK transition; current-window health remains 120 seconds while AFK health uses 300 seconds. The full soak was restarted from zero and passed.
- The first beta harness attempt passed a directory instead of a SQLite file to `--dbpath`, producing a poisoned beta datastore. The isolated harness now passes `isolated-db/sqlite.db`; server, both watchers and Query API passed.

## 5. Remaining Manual Risk

- A real multi-day soak cannot be compressed into this release run.
- Windows sleep/resume and disk-exhaustion behavior need continued real use after release.

## 6. Release Gate

- Status: PASS FOR LOCAL WINDOWS BETA
- Decision: v0.7.2 is installable for continued self-use. It is not a signed public release and does not satisfy the existing external-user or multi-day reliability gates for v1.0.
