# Design — Codex Project Attention Classification v0.2

## Architecture

The feature combines two independent truth sources:

1. ActivityWatch remains the only authority for foreground window intervals and AFK.
2. The official Codex app-server remains the authority for interactive thread metadata and recency.
3. A local tracker stores sparse context transitions only while Codex is foreground and the user is active.
4. The existing aggregation layer joins ActivityWatch intervals with stored transitions to produce project attention.

No renderer code reads files, launches processes, or talks to localhost directly. All native work stays in the Electron main process and is exposed through typed IPC.

## Data flow

```text
ActivityWatch current window + AFK
             |
             | active Codex foreground only
             v
CodexContextTracker ----> Codex app-server thread/list
             |                 (vscode sources, recency sort)
             v
AppStore context transitions (Unix ms)
             |
             +----> aggregateActivity(day events, AFK, samples, aliases)
                              |
                              +----> project usage + coverage + pending
                              +----> dashboard / diagnostics
                              +----> privacy-reduced AI review payload
```

## Context selection

- Query `thread/list` with `sourceKinds: ["vscode"]`, `sortKey: "recency_at"`, descending order, non-archived, and `useStateDbOnly: true`.
- Select only a valid root interactive thread with a non-empty cwd. This is the most recently interaction-confirmed thread because official `recencyAt` advances when a turn starts; it is not proof of a silent sidebar selection.
- Poll every five seconds only when ActivityWatch says the Codex window is foreground and AFK status is active.
- Persist the initial sample and subsequent changes in thread id or recency value. Repeated identical results do not grow the store.
- If app-server fails, retain an error status and assign subsequent Codex foreground time to `待分类` until a valid transition is observed.

`recencyAt` is an interaction-confirmation signal supplied by Codex, not proof of user attention or a desktop selection. ActivityWatch foreground and AFK gates are therefore mandatory. Pure browsing after silently selecting another thread remains a known v0.2 limitation.

## Project identity

Every sample preserves the thread boundary. The display grouping uses:

1. An explicit alias when the user has corrected a detected project label.
2. A normalized specific cwd as the stable project key and its basename as label.
3. For generic workspace roots (for example `codex work`, `workspace`, or very short temporary folder names), the thread id as key and cleaned conversation name as label.
4. A final `Codex 未命名项目` fallback when neither source is readable.

The UI presents project label plus recent conversation title so the source remains auditable. Renaming changes only presentation and grouping label; it never changes which thread is considered current.

## Attribution model

- Convert AFK events to intervals.
- Subtract AFK intervals from each window event to produce active sub-intervals.
- Only Codex window events enter project attribution. Other app aggregation remains unchanged.
- Split Codex intervals at context-sample timestamps.
- Use the latest sample at or before each sub-interval start.
- Do not extrapolate backward before the first sample. Those seconds go to `待分类`.
- Merge attributed seconds by project key and expose classified/unclassified coverage.

The five-second sampling interval creates at most a small conservative unclassified edge around a switch rather than falsely assigning it.

## Store migration

Persisted data moves from version 1 to version 2:

```ts
type PersistedDataV2 = {
  version: 2
  settings: Settings
  records: Record<string, DailyRecord>
  codexContextSamples: Record<string, CodexContextSample[]>
  projectAliases: Record<string, string>
}
```

Loading version 1 supplies empty samples and aliases. Existing records and settings are copied unchanged. Samples are capped per day and old days are pruned conservatively to prevent unbounded growth.

## Process lifecycle and failure recovery

- `CodexAppServerClient` owns one hidden child process and one JSONL connection.
- It performs the required `initialize`/`initialized` handshake once and correlates requests by id.
- Pending requests time out with actionable Chinese errors.
- Unexpected exit rejects pending requests; the next sample attempt may restart the process with backoff.
- Application shutdown stops the tracker and child process.
- ActivityWatch pause also prevents new context samples.

## Privacy

- Keep raw thread id, cwd, and conversation name local.
- The renderer may display the current local context and project source to the user.
- AI review receives only final project display labels and rounded minutes, never raw ids/cwds or the full context transition stream.

## Observability

Diagnostics add:

- Codex app-server availability/version.
- Latest successful context detection and freshness.
- Whether Codex is currently foreground and active.
- Classified coverage and unclassified reason in the report.

Errors must explain the repair action: install/login/update Codex CLI, reopen a Codex conversation, or wait for the first foreground sample.

## Rejected alternatives

- Window-title parsing: rejected because the real Windows title is only `ChatGPT`.
- Reading `state_5.sqlite` directly: rejected because it is a private storage implementation and the official app-server already exposes the required metadata.
- Process runtime: rejected because background agent execution is not user attention.
- Manual context switch: rejected because the user explicitly wants conversation selection to be the boundary.
- Retroactive inference from the latest thread: rejected because it would fabricate historical switches.

## Rollback

Revert the v0.2 commit and reinstall v0.1. The old code ignores the additional JSON properties. ActivityWatch raw data remains untouched.
