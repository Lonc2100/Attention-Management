# Technical Design

## Chosen interaction model

Option A, a three-pane investigation workspace, is selected. It keeps overview, chronological evidence, and correction actions visible without turning the page into a spreadsheet.

```text
+----------------------+----------------------------------------------+---------------------------+
| global navigation    | date / search / filters                      | rules toggle              |
|                      +----------------------------------------------+---------------------------+
| Activity Details     | recorded-range timeline                      | selected evidence         |
|                      +----------------------------------------------+ app / title / source      |
|                      | chronological interval list                  | project correction        |
|                      |                                              | optional future rule      |
+----------------------+----------------------------------------------+---------------------------+
```

Alternatives considered:

```text
A  Three-pane investigation     timeline + list + evidence drawer       SELECTED
B  Dense spreadsheet            maximum density, weak temporal reading
C  Calendar lanes               familiar clock, wastes horizontal space
D  Project-first tree           good totals, hides uncertain intervals
E  Correction queue only        efficient cleanup, weak full-day context
F  Split-day chapters           readable narrative, hard to scan precisely
```

## Persistence

Store version 4 extends the existing JSON store:

```ts
classificationRules: ActivityRule[]
activityOverrides: Record<string, ActivityOverride[]>
manualProjects: Record<string, string>
```

Migration from v3 supplies empty values only; it does not reinterpret existing records.

## Shared contracts

- `ActivityRule`: app exact match, title mode/pattern, target project, enabled flag, creation/apply timestamps.
- `ActivityOverride`: selected date/start/end/app/title and target project.
- `ActivityDetailEntry`: evidence plus final attribution metadata.
- `ActivityDetails`: date, actual range, entries, project options, rules, and source-health flags.
- Typed inputs for correction, removal, rule mutation, and manual project creation.

## Classification pipeline

```text
ActivityWatch window events
  -> subtract AFK overlaps
  -> split at Codex-context, override, rule-start boundaries
  -> classify each segment once
       manual override
       first enabled future-valid rule
       confirmed Codex context
       application/unclassified fallback
  -> merge adjacent equal segments for details/timeline
  -> derive dashboard summary and focus from the same classified segments
```

Manual overrides are immutable records rather than edits to raw ActivityWatch data. Removing an override simply exposes the next classifier in the precedence chain.

## Rule semantics

- Rules are ordered; the first enabled match wins.
- App matching is case-insensitive exact matching.
- Title matching supports case-insensitive `contains` and `exact`.
- `appliesFrom` defaults to the correction time, so history is stable.
- Rule creation is unavailable for empty titles or titles shorter than four visible characters after normalization.
- Manual override always wins, including after rule reorder.

## IPC and privacy

- `getActivityDetails(date)` is separate from bootstrap/refresh, keeping raw window titles out of ordinary dashboard traffic.
- Mutation handlers validate IDs, dates, intervals, title modes, patterns, and project labels.
- Renderer never reads ActivityWatch directly.
- Error messages are user-readable and do not expose local file paths.

## Failure handling

- ActivityWatch unavailable: preserve page chrome and show a retry state.
- AFK bucket unavailable: return partial details with an explicit warning, not false certainty.
- Rule conflict: explain first-match priority and offer reorder controls.
- Stale selected interval after refresh: clear selection instead of editing the wrong entry.
- Mutation failure: keep draft values and show an error toast.
