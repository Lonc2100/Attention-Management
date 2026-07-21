<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

# Attention Management Harness-lite

## Core Read Order

1. Read `.trellis/workflow.md` and the active task artifacts.
2. Read `docs/context/index.md`.
3. Read `ARCHITECTURE.md` before changing source boundaries.
4. Read only the feature-specific PRD, release note, and source files needed for the task.

## Fixed Route

`Shared Types / Pure Rules -> Main Providers + Repositories -> Main Services -> Electron Runtime / IPC -> Preload Bridge -> Renderer UI`

Trellis is the source of truth for tasks, PRDs, plans, and version history. Harness context files are an engineering map, not a second product backlog.

## Required Verification

- Normal code or documentation change: `npm run verify`.
- UI journey change: `npm run verify` and `npm run test:e2e`.
- Installer or startup change: use the release smoke, installed-app, data-retention, and autostart checks documented by the active Trellis task.

## Boundary Rules

- `src/shared` must stay platform independent and must not import Electron, Node built-ins, or process-specific code.
- `src/renderer` uses `window.timeEfficiency`; it must not import `src/main`/`src/preload` or call ActivityWatch directly.
- `src/preload` may expose typed IPC contracts only; it must not contain business logic or import `src/main`.
- `src/main` owns OS integration and composition but must not import renderer code.
- External executables, local commands, third-party APIs, and Windows automation belong behind Provider boundaries as the code is incrementally split.
- Do not move files only to satisfy an idealized tree. Add a boundary first, freeze behavior with tests, then move one responsibility at a time.
