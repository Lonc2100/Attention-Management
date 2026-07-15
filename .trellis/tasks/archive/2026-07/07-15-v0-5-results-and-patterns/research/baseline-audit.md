# v0.4.2 Baseline Audit

## Repository state

- Branch `main` equals `origin/main` at `ba153d7` before the new roadmap task.
- Version/tag: v0.4.2.
- Installed application: v0.4.2, running from the per-user Programs directory.

## Quality baseline

- Unit: 37 passed, 3 environment-gated integration tests skipped.
- TypeScript: passed.
- Production build: passed.
- Electron E2E: 12 passed, including ActivityWatch, dashboard, activity correction/rules, widget, plan/review, Codex CLI, pause/resume, diagnostics and restart persistence.

## Architecture facts

- Main: ActivityWatch access, classification, aggregation, Codex context, JSON store and IPC live under `src/main`.
- Shared: all cross-process types and channels are centralized in `src/shared/contracts.ts`.
- Renderer: one React shell with data, plan, review, diagnostics and settings views; typed preload is the only native boundary.
- Storage: JSON schema v4; records, context samples, aliases, rules, overrides and manual projects are all local.

## Gaps for v0.5

- Outcome does not carry project keys.
- Bootstrap does not expose known project options.
- Dashboard and review cannot calculate outcome-supporting attention.
- No historical insights IPC or view exists.
- AI payload has outcome status and project ranking but no explicit outcome/project evidence.
- Root `TASK.md` was stale at v0.4.1 and has been replaced by the continuous-route controller.

## Existing debt not pulled into v0.5

- No `npm run lint` script exists; typecheck, unit and build remain current gates. Introducing lint belongs to v0.6/v1.0 engineering hardening.
- Some universal Trellis specs describe SQLite/Tailwind/pnpm, while this project intentionally uses JSON/CSS/npm. Project code and current package manager remain authoritative.
- GitHub CLI is not authenticated, but existing Git credential-based pushes work; GitHub Release page creation may remain unavailable without a login and must not block tag pushes.

