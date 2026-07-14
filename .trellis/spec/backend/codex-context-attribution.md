# Codex Foreground Context Attribution

## 1. Scope / Trigger

Use this contract when splitting Codex desktop attention across projects. ActivityWatch is the authority for foreground and AFK state; the official Codex app-server is only the context source. Never infer attention from process runtime, thread recency alone, or private Codex databases.

## 2. Signatures

```ts
CodexAppServerClient.listRecentInteractiveThreads(): Promise<CodexThreadSummary[]>
CodexContextTracker.sample(date: string): Promise<void>
aggregateActivity(events, afkEvents, notes, tracking, buckets, samples, aliases, status): ActivitySummary
TimeEfficiencyApi.setProjectAlias({ projectKey, label }): Promise<ActivitySummary>
```

Persisted data version 2 adds `codexContextSamples: Record<date, CodexContextSample[]>` and `projectAliases: Record<projectKey, label>` without changing daily records.

## 3. Contracts

- App-server request: `thread/list`, `sourceKinds: ["vscode"]`, `sortKey: "recency_at"`, descending, root threads only. Treat the result as most recently interaction-confirmed; `recencyAt` advances on turn start and is not a silent desktop-selection signal.
- Sample timestamps and `recencyAt` are Unix milliseconds; app-server wire `recencyAt` is converted from seconds.
- Sampling is allowed only when the current ActivityWatch event is fresh, the app/title identifies Codex, and AFK status is active.
- Output includes project seconds, unclassified seconds, classification coverage, and current local context.
- AI payload may include project label/rounded minutes only. It must exclude thread id, cwd, conversation title, and raw window events.

## 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Invalid app-server envelope | Reject with an actionable Codex app-server error |
| Sub-agent or missing-recency thread | Exclude it from candidates |
| Codex background, AFK, or stale ActivityWatch heartbeat | Do not query or persist context |
| No sample before a Codex interval | Attribute the interval to `待分类`; do not backfill |
| Blank/unclassified alias request | Reject or remove the alias; never create a manual context switch |
| Version 1 local data | Preserve settings/records and initialize empty samples/aliases |

## 5. Good / Base / Bad Cases

- Good: two foreground conversation transitions yield two project rows, with AFK overlap removed.
- Base: the first trustworthy sample starts classification; earlier Codex time stays pending.
- Bad: assigning the entire day to the latest thread or counting a background agent as user attention.

## 6. Tests Required

- Unit: folder/thread identity, aliases, transition splitting, AFK subtraction, pending time, Classic exclusion.
- Protocol: Zod validation, seconds-to-milliseconds conversion, sub-agent filtering, restartable client errors.
- Tracker: no query while background/AFK; transition persistence only while active.
- Privacy: serialized AI payload contains project aggregates and none of the raw identifiers.
- E2E/package: context banner, project panel, diagnostics, migration, installer upgrade, and startup.

## 7. Wrong vs Correct

```ts
// Wrong: recency is treated as attention and historical time is guessed.
projectSeconds[threads[0].id] += wholeCodexDay

// Correct: foreground + non-AFK gates sampling; intervals before a sample stay pending.
if (state.isCodexForeground && !state.isAfk && state.fresh) await tracker.sample(date)
```

The conservative gap is intentional: incomplete truth is preferable to precise-looking fabricated attribution.
