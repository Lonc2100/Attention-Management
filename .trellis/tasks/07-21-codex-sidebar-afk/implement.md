# Implementation Plan

1. [x] Run the current real Codex window integration to record the baseline.
2. [x] Add Provider and Service folders; move pure visible-context reading and attribution logic without changing renderer IPC contracts.
3. [x] Preserve `CodexContextTracker` as a lifecycle wrapper so bootstrap changes remain narrow.
4. [x] Add side-bar-aware UI Automation selection and negative tests for ambiguity.
5. [x] Change only the new-user AFK default and associated explanatory copy/tests.
6. [x] Run Harness gates, unit tests, E2E, package smoke, and the live context integration.
7. [x] Live UI Automation cannot identify the sidebar reliably; evidence is recorded and product-success claim is blocked.

## Evidence · 2026-07-21

- Real `RUN_CODEX_WINDOW_INTEGRATION=1` failed with `visible === null` in 332ms. Windows UI Automation exposed only `RootWebArea`; no selected sidebar/list/chat descendant was present. The local Codex app-server schema had no current-desktop-selected-thread method.
- `npm run verify`: 87 tests passed, 3 opt-in external Codex tests skipped; Harness boundary, TypeScript and production build passed.
- Two independent `npm run test:e2e` runs: 17 Electron checks each passed, including new 5-minute copy, AFK override/reversal and restart persistence.
- `npm run dist`: Windows x64 NSIS installer built successfully. `node tests/packaged-smoke.mjs` passed. SHA-256: `3E67E51563B956D49AA09935365F9F9FA2AAAA819449A9CB038F555E2DDA94AB`; Authenticode: `NotSigned`.
- Existing user data read-only check found `idleThresholdMinutes: 15`; the code preserves that valid value. A raw AFK observation of 212.4 seconds stayed below the new 5-minute major-absence threshold.
- New finding repaired during E2E: an AFK manual override with no overlapping foreground event used to become invisible/unreversible. It now renders a neutral, reversible “人工计入工作” residual entry.
- No installer upgrade was applied to the user's current v0.7.4 installation because the primary sidebar-recognition goal is externally blocked; the package is a validated draft, not a claimed finished fix.
