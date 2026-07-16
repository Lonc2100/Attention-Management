# v0.7.0 Technical Design

## Current and target composition

Current homepage:

```text
┌ current focus ───────────────────────────────────────┐
├ reminder + daily metrics ────────────────────────────┤
├ priority outcome evidence ───────────────────────────┤
├ today donut + legend ────────────────────────────────┤
├ today timeline ──────────────────────────────────────┤
└ project/application detail ──────────────────────────┘
```

Target homepage (selected default):

```text
┌ current focus ───────────────────────────────────────┐
├ compact today summary + priority evidence ───────────┤
├ { WORK ACTIVITY }              [每日][每周][每月] ────┤
│ year/week/month cells + hover/focus tooltip          │
│ 本期投入 | 日均 | 成果占比 | 长专注 | 成果完成        │
├ today donut + legend ────────────────────────────────┤
├ today timeline ──────────────────────────────────────┤
└ project/application detail ──────────────────────────┘
```

Current and target widget:

```text
Current 316×68:  ● [状态 / 项目] | [连续专注 / 00:23] [+]
Target  252×48:  ● [项目名称........]       [00:23] [›]

Expanded target 268×150:
┌ ● 项目名称                 00:23  [⌃] ┐
├ 今日项目 18分 · 电脑投入 5时23分        ┤
├ ━━━━━━━━━ 6%                           ┤
└ 前台注意力自动更新         [打开] [隐藏] ┘
```

## Data boundaries

### ActivityWatch range query

Add a read-only ActivityWatch Query API adapter. For 366 daily time periods, submit one query request:

```text
window events = flood(query_bucket(window bucket))
not-afk events = filter status == not-afk
active events = filter_period_intersect(window, not-afk)
RETURN { activeSeconds, observedWindowSeconds }
```

ActivityWatch evaluates the query independently for every supplied time period and returns one result per period. This keeps the calendar load bounded to one bucket lookup plus one query request instead of hundreds of daily summary requests. If the Query API is unavailable, return an explicit unavailable state; do not silently fall back to 366 raw-event requests.

### Shared aggregation

Create pure shared functions that:

- convert the 366 daily facts into calendar-week and calendar-month cells;
- apply fixed duration levels;
- calculate period metrics from existing `DailyRecord` and `ActivitySummary` inputs;
- union result-linked project keys per day before summing attention;
- count project timeline slices at least 45 minutes;
- keep unavailable separate from a valid zero.

Daily chart facts remain ActivityWatch-owned. Plan/review outcome facts remain store-owned. No new persistent data schema is required.

### IPC contract

Add a read-only `work-activity:get` IPC endpoint returning:

- generated timestamp and source quality;
- 366 daily activity facts;
- day/current-week/current-month metric summaries.

The preload exposes one typed method. Main-process handlers validate no user-controlled query language; the query template is fixed in code.

### Date drill-down

`App` owns an optional activity-details date. `TodayDashboard` emits the selected date through a callback; `ActivityDetailsView` accepts it as initial/controlled selection. Existing manual navigation continues to default to today.

## Performance and caching

- Cache the range result in memory for five minutes.
- The current day is refreshed from Bootstrap data when rendered so its value is not stale behind the cache.
- Week/month aggregation runs in shared pure functions and does not call ActivityWatch again.
- Recent detailed summaries needed for project/outcome metrics are limited to the current natural month and may reuse the existing per-day aggregation path; the result shares the same five-minute cache.
- Renderer tooltips use target-bound positioning and pointer enter/focus events only; no mousemove state loop or blur filter.

## Compatibility

- No store migration.
- Existing v0.6.2 settings and data remain valid.
- Widget dimensions change but stored top-left position and display ID remain; `widgetBounds` clamps the new size.
- Existing `getInsights(7|14|30)` and the separate personal-rules page remain compatible.

## Visual contract

- Activity cells use green intensity only; orange is reserved for unavailable/uncertain state.
- Empty grid uses a warm charcoal surface, not pure black.
- Priority completion is a cream inner marker, not a sixth category color.
- No drop shadows. The widget uses an opaque or correctly clipped surface that does not recreate the prior black-corner artifact.
- Typography remains compact UI scale; editorial display sizing is not used inside the dashboard module.

## Rollback

- The feature is additive and can be removed by deleting the new IPC endpoint/module while leaving v0.6.2 dashboard contracts intact.
- No persistent schema rollback is required.
- If transparent rounded widget rendering recreates black corners on the real Windows install, retain the smaller dimensions but revert to a fully opaque rectangular window surface before release.

