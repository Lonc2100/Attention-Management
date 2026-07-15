# Implementation Plan

1. Add failing tests for v4 store migration and CRUD invariants.
2. Add shared contracts and store migration for rules, overrides, and manual projects.
3. Extract a single interval classification engine and add tests for precedence, future-only rules, AFK subtraction, and cross-app project attribution.
4. Add ActivityWatch detail loading and typed IPC handlers.
5. Build the Activity Details page, evidence drawer, correction flow, and rule manager.
6. Update dashboard terminology and focus behavior for cross-app project attribution.
7. Add component/state regression checks and extend end-to-end coverage.
8. Run typecheck, tests, build, packaged smoke, installer smoke, and installed-app checks.
9. Update product docs/changelog, commit, tag `v0.4.0`, push, install, and verify the running version.

## Regression focus

- Existing v3 persisted data opens without loss.
- Morning plan, evening review, dashboard, diagnostics, settings, floating widget, tray, autostart, and ActivityWatch lifecycle remain intact.
- Codex project attribution still uses confirmed foreground context and privacy redaction.
- Summary duration never exceeds active non-AFK duration.
- Rules cannot silently rewrite earlier activity.
