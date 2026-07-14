# Decision Log

## Automatic Codex context source

- Decision: combine ActivityWatch foreground/AFK events with the official `codex app-server` root-thread list.
- Evidence: the Windows Codex window exposes only `ChatGPT.exe / ChatGPT`, while app-server exposes root thread id, name, cwd, and recency.
- Rejected: window-title parsing, direct `state_5.sqlite` reads, process runtime, and a manual project switch.
- Risk control: sparse transitions, five-second sampling, Zod validation, retry backoff, and `待分类` for every interval without a trustworthy prior sample.
- Accuracy limit: app-server confirms a task when a turn starts; a silent click is not observable. The UI must say “最近确认”, not claim a guaranteed selected task.
- Rollback: revert v0.2; version 1 fields remain intact and extra version 2 fields are ignorable.

## Privacy boundary

- Decision: raw thread metadata stays local and is available only for the user's local audit surface.
- AI contract: project labels/minutes, app labels/minutes, outcomes, review text, score, and optional offline notes.
- Explicitly excluded from AI: thread ids, cwd values, conversation names, raw window titles, and transition streams.

## Test-environment watcher isolation

- Decision: Electron E2E compares watcher process counts before/after its own pause action.
- Reason: an already-installed production app may legitimately own another watcher, so asserting zero system-wide watcher processes creates a false failure.
