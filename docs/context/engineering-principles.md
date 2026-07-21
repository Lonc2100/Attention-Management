# Engineering Principles

## Existing Product First

Preserve working behavior and user data. Prefer one tested extraction over a directory-wide migration.

## Fixed Route

`Shared Types / Pure Rules -> Main Providers + Repositories -> Main Services -> Electron Runtime / IPC -> Preload Bridge -> Renderer UI`

## Simple First

- Use typed normal code before adding an agent or heuristic.
- Reuse ActivityWatch and mature Windows/Electron capabilities rather than replacing them.
- Add a layer only when it owns a real responsibility; do not generate empty layers for symmetry.

## Evidence First

- A green architecture check must include negative fixtures that demonstrate it can fail.
- Skipped live integration tests are an explicit validation gap, not evidence of success.
- Keep `npm run verify` fast and deterministic; place installed-app and real-provider tests in release gates.

## Governance

- Read before writing.
- Surface conflicts between docs and code.
- Fail loudly at unsafe boundaries.
- Trellis owns task and product truth; Harness owns architecture readability and enforcement.
