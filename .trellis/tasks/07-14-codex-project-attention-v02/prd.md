# Codex Project Attention Classification v0.2

## Goal

Automatically split foreground Codex attention time by the Codex conversation/project the user is actively working in, without requiring a manual context switch.

## User value

The daily report must answer not only "how long was Codex open" but "which outcomes/projects received the user's actual foreground attention" so the evening review can compare time allocation with important results.

## Confirmed facts

- ActivityWatch records `ChatGPT.exe` with a generic `ChatGPT` window title for the Windows Codex app; the window event alone cannot identify a project.
- The installed Codex CLI exposes the official `codex app-server` JSON-RPC interface.
- `thread/list` returns interactive Codex threads with `id`, `name`, `cwd`, and `recencyAt`, and can sort by `recency_at`.
- Codex threads preserve their working directory, while the desktop app may keep multiple threads active in parallel.
- The existing app already subtracts AFK overlap and persists plans/reviews locally.

## Requirements

1. Count Codex project time only when ActivityWatch reports the Codex desktop window in the foreground and the user is not AFK.
2. Detect the most recently interaction-confirmed conversation automatically through the official Codex app-server; do not add a manual "current context" switch or claim silent desktop selection is observable.
3. Persist only context transitions needed for time attribution: timestamp, thread id, thread name, cwd, derived project identity, and source metadata.
4. Use the Codex conversation as the boundary signal. Derive a readable project label from a specific project folder; when the cwd is generic, derive it from the conversation name.
5. Put intervals without a reliable context sample into `待分类`; never guess or backfill historical time from a single latest-thread value.
6. Show current/last detected Codex context, per-project attention, classified coverage, and unclassified time in the application.
7. Allow an optional display-name correction for an automatically detected project. Renaming must not be required for tracking and must not act as a context switch.
8. Add Codex context diagnostics and actionable Chinese errors while keeping ActivityWatch, plans, reviews, reminders, tray behavior, and login startup compatible.
9. Include project-level minutes in the AI review payload, but do not send raw thread ids, cwd values, or the complete title/event stream.
10. Upgrade existing local data in place without losing v0.1 plans, reviews, settings, or ActivityWatch data.

## Behavior slices

### Slice A — project identity

- Public interface: pure `deriveProjectIdentity(thread, aliases)` function.
- Input/action: a thread with a specific cwd or a generic cwd plus conversation name.
- Expected: stable project key and readable label; explicit alias wins.
- Mock boundary: no filesystem or Codex process calls.

### Slice B — conservative time attribution

- Public interface: `aggregateActivity(..., contextSamples, aliases)`.
- Input/action: Codex window events, AFK intervals, and context transitions.
- Expected: split at transition timestamps, subtract AFK, and assign gaps to `待分类`.
- Mock boundary: raw ActivityWatch events only; no live HTTP calls.

### Slice C — official Codex context lookup

- Public interface: `CodexAppServerClient.listRecentInteractiveThreads()`.
- Input/action: initialize a Codex app-server connection and call `thread/list` sorted by recency.
- Expected: validated thread metadata or an actionable error; sub-agent threads excluded.
- Mock boundary: spawned child process and JSONL transport.

### Slice D — foreground sampler

- Public interface: `CodexContextTracker.sample()`.
- Input/action: current ActivityWatch foreground/AFK state plus current Codex thread.
- Expected: persist one transition when the active context changes; do nothing while Codex is background or user is AFK.
- Mock boundary: ActivityWatch foreground state, Codex client, and store.

### Slice E — user-visible report

- Public interface: bootstrap/refresh IPC and React dashboard.
- Input/action: open the dashboard after classified and unclassified Codex intervals exist.
- Expected: automatic context banner, project rows, coverage, unclassified explanation, alias correction, and diagnostics.
- Mock boundary: IPC responses in unit/E2E tests.

## Acceptance criteria

- [x] Starting a turn in each of two Codex conversations while Codex stays foreground creates two project attention rows without manual switching.
- [x] Codex time overlapping AFK is excluded from both project and unclassified attention.
- [x] Codex foreground time with no trustworthy sample appears as `待分类` and coverage reflects it.
- [x] Background Codex work, sub-agents, and simple process runtime do not create attention time.
- [x] The dashboard shows the automatically detected current/last Codex context and why a period is unclassified.
- [x] An optional project rename changes display labels without changing the sampling/attribution boundary.
- [x] AI review receives only project label/minute aggregates plus existing outcome/review data.
- [x] v0.1 persisted data loads without loss and is saved in the new versioned format.
- [x] Unit, integration, Electron E2E, packaged smoke, installed upgrade, and startup checks pass.
- [ ] The source, documentation, installer, and verification report are committed and pushed to public `main`.

## Out of scope

- Mobile and offline activity collection beyond existing manual AFK notes.
- Screen recording, OCR, keystroke text, or prompt-content capture.
- Retrospective reconstruction of Codex project switches that occurred before v0.2 sampling existed.
- Cloud sync, team analytics, or cross-device identity.
- Automatic semantic merging of unrelated folders into one conceptual project.
- Exact attribution after silently clicking another existing task but before starting its next turn; the official protocol exposes no desktop-selection event.

## Rollback

One code revert restores v0.1 behavior. The v0.2 store migration retains the existing record shape; extra context samples and aliases can be ignored safely by older code.
