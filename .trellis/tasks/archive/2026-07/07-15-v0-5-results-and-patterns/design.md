# v0.5.0 Technical Design

## Current Behavior

- `Outcome` only stores `id` and `title`; project attribution exists only in activity data.
- Morning plan and evening review are persisted in JSON store version 4.
- Renderer talks to thin main-process IPC handlers through the typed preload API.
- ActivityWatch events are already AFK-filtered and conservatively classified into mutually exclusive timeline leaves.
- AI review receives only aggregated labels/minutes and user-authored review text.

## Data Model

- Add `projectKeys: string[]` to `Outcome`.
- Add shared `OutcomeEvidence`, `InsightDay`, `InsightHour`, and `PersonalInsights` contracts.
- Persist as JSON store version 5. Migration normalizes every historical outcome to an array and preserves all unrelated v4 fields.
- Add `BootstrapData.projectOptions` so the plan UI uses known Codex/manual projects without querying raw activity details.

## Core Calculation

Create a pure `outcome-insights` module:

1. Outcome evidence sums only project attention slices whose key is explicitly linked.
2. Context switches count adjacent non-AFK timeline leaves with different category keys.
3. Hour buckets split timeline duration at local clock-hour boundaries.
4. Candidate hours use only reviewed days where priority status is `done` and subjective score is at least 4.
5. Fewer than 3 qualifying days returns `insufficient`; no productivity score is emitted.

## Cross-layer Flow

```text
Plan UI -> typed IPC -> main validation -> AppStore v5
ActivityWatch historical summary + DailyRecord[] -> pure insights -> typed IPC -> InsightsView
DailyRecord + current ActivitySummary -> pure evidence -> dashboard/review/AI payload
```

## UI

- Plan rows keep the current three-outcome form and add compact project chips below each non-empty outcome.
- Dashboard adds one compact priority-result evidence card; it does not enlarge the existing top metrics.
- Review rows show evidence inline.
- New sidebar item “个人规律” renders range controls, daily evidence bars, candidate hours, and explicit data-quality language.

## Risks and Mitigations

- Historical queries: query 7/14/30 days only on demand; read bounded days sequentially to avoid bursting the local ActivityWatch service, and expose partial/connection state.
- Shared projects: never expose a combined outcome-attention total.
- Migration: normalize unknown/missing arrays, preserve unrelated objects, and compare real-data semantic counts before and after install without deleting or rewriting source facts.
- Time zones: split ISO intervals using local `Date` hour boundaries, matching the existing local day keys.
- Stale UI: current evidence derives from current `record + activity`; multi-day insights reload on range change.

## Rejected Alternatives

- Automatic semantic outcome inference: confidence is not inspectable enough for v0.5.
- New analytics database: unnecessary while the bounded 30-day query is small.
- Reusing ActivityWatch categories as outcomes: categories describe activity type, not user-defined results.
- Single productivity score: hides outcome state and encourages false precision.

## Rollback

Revert the v0.5 code and reinstall v0.4.2. The v5 JSON remains readable as v4 input because the added outcome field is ignored; do not delete the user-data directory during rollback.
