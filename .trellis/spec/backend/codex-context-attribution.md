# Codex Foreground Context Attribution

## 1. Scope / Trigger

Use this contract when splitting Codex desktop attention across projects. ActivityWatch is the authority for foreground and AFK state; Windows UI Automation is the authority for which project chat is currently visible; the official Codex app-server maps that visible context to a stable thread identity. Never infer attention from process runtime, thread recency alone, or private Codex databases.

## 2. Signatures

```ts
CodexAppServerClient.listRecentInteractiveThreads(): Promise<CodexThreadSummary[]>
CodexWindowContextReader.readCurrentContext(): Promise<VisibleCodexContext | null>
matchVisibleCodexThread(visible, threads): CodexThreadSummary | null
CodexContextTracker.sample(date: string): Promise<void>
aggregateActivity(events, afkEvents, notes, tracking, buckets, samples, aliases, status): ActivitySummary
TimeEfficiencyApi.setProjectAlias({ projectKey, label }): Promise<ActivitySummary>
```

Persisted data version 2 adds `codexContextSamples: Record<date, CodexContextSample[]>` and `projectAliases: Record<projectKey, label>` without changing daily records.

## 3. Contracts

- App-server request: `thread/list`, `sourceKinds: ["vscode"]`, `sortKey: "recency_at"`, descending, root threads only. Ordering is not attribution; `recencyAt` is metadata only.
- On Windows, read only the Codex top-bar project label and current chat title through UI Automation. Do not capture screenshots, key input, message bodies, or persist the accessibility tree.
- Match the visible title exactly after Unicode/whitespace normalization. If duplicate titles exist, use visible project label versus cwd basename; accept only one candidate.
- If the UI signal is absent, there are no candidates, or multiple candidates remain, clear current context and leave the interval unclassified. Never retain the previous project as a fallback.
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
| Current Codex UI context missing or ambiguous | Clear current context; leave interval unclassified |
| Windows UI Automation process errors or times out | Surface a recoverable error; never retain the old project |
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
- Tracker: no query while background/AFK; visible B overrides more-recent A; missing/ambiguous selection clears A.
- Privacy: serialized AI payload contains project aggregates and none of the raw identifiers.
- E2E/package: context banner, project panel, diagnostics, migration, installer upgrade, and startup.

## 7. Wrong vs Correct

```ts
// Wrong: recency is treated as attention and historical time is guessed.
projectSeconds[threads[0].id] += wholeCodexDay

// Correct: foreground + non-AFK gates sampling; current visible chat must map uniquely.
if (state.isCodexForeground && !state.isAfk && state.fresh) {
  const visible = await windowContext.readCurrentContext()
  const current = visible ? matchVisibleCodexThread(visible, await appServer.listThreads()) : null
  if (current) persist(current)
}
```

The conservative gap is intentional: incomplete truth is preferable to precise-looking fabricated attribution.
