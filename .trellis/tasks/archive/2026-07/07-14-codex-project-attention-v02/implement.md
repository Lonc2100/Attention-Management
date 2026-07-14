# Implementation Plan — Codex Project Attention Classification v0.2
## Ordered slices

1. Add shared contracts for Codex threads, samples, project usage, tracker status, aliases, diagnostics, and IPC.
2. Write failing unit tests for project identity, conservative interval splitting, AFK subtraction, pending time, alias behavior, and v1-to-v2 store migration.
3. Implement pure project identity and aggregation functions until unit tests pass.
4. Implement the persistent Codex app-server JSONL client with runtime validation and a mocked transport test.
5. Add ActivityWatch current-window/current-AFK probes and implement the five-second context tracker.
6. Extend AppStore with sparse transition persistence, retention limits, aliases, and migration.
7. Wire startup/shutdown, bootstrap/refresh, diagnostics, alias IPC, and privacy-reduced AI input in the Electron main process.
8. Add the automatic context banner, project attention report, coverage state, pending explanation, and optional rename UI.
9. Update E2E fixtures/checks and documentation; bump version to 0.2.0.
10. Run the full validation matrix, create the Windows installer, upgrade the installed app, and verify autostart/tray/real data.

## Validation commands

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run dist
node tests/packaged-smoke.mjs
node tests/installed-autostart.mjs
```

Additional live checks:

- Official app-server returns the current root `vscode` thread and cwd.
- A real ActivityWatch Codex foreground event is classified after sampling.
- AFK or background intervals create no classified project attention.
- An app-server failure produces `待分类` plus a diagnostic instead of a guessed project.
- The v0.1 user-data file loads and remains intact after upgrade.
- Closing the main window keeps the tray collector running; login startup still uses `--hidden`.

## Risky files and rollback points

- `src/main/aggregate.ts`: preserve existing app totals while adding interval splitting. Roll back this slice independently if totals regress.
- `src/main/store.ts`: migration must write only after a valid in-memory conversion. Keep version-1 fields unchanged.
- `src/main/index.ts`: tracker timers and child processes must be stopped on quit and must not block app startup.
- `src/renderer/src/App.tsx`: keep existing plan/review navigation and actions intact.
- `package.json`: preserve `appId` so v0.2 upgrades the installed v0.1 application.

## Review gates

- No direct SQLite dependency or screen/input capture.
- No non-null assertions, `any`, silent catch for a user-visible failure, or renderer-native access.
- The app-server client has request timeout, exit cleanup, and restart behavior.
- Context samples use Unix milliseconds and have a retention cap.
- Project time never exceeds active Codex foreground time after AFK subtraction.
