# Current Engineering State

Updated: 2026-07-21

- Product: Windows local-first Electron application.
- Runtime: Electron + React + TypeScript, bundled ActivityWatch, Codex context integration.
- Persistence: local JSON/cache managed by the Electron main process.
- Baseline before Harness-lite: 84 unit tests passed, 3 live integration tests skipped, Node and Web typechecks passed.
- Existing process folders: `src/main`, `src/preload`, `src/renderer`, `src/shared`.
- Current hotspots: `src/main/activitywatch.ts`, `src/main/index.ts`, `src/shared/contracts.ts`, `src/main/store.ts`.
- Known product issue outside this architecture task: Codex sidebar attribution needs real integration repair; skipped integration tests do not prove it works.

Use the active Trellis task for current feature scope and acceptance evidence. Update this file only when the verified engineering baseline or architecture hotspots materially change.
