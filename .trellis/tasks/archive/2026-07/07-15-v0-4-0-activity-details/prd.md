# v0.4.0 Activity Details, Corrections, and Learned Rules

## Goal

Turn passive ActivityWatch data into an inspectable and correctable attention ledger. The user must be able to see what evidence produced each project attribution, correct a wrong interval, and optionally teach a conservative future-facing rule.

## User stories

- As a user, I can inspect a chronological list of active computer intervals without mixing plan or review content into the data page.
- As a user, I can select an interval and see its time range, application, window title, attribution source, and project.
- As a user, I can correct an interval to an existing or newly named project without changing ActivityWatch raw events.
- As a user, I can optionally turn a correction into a rule for future matching activities.
- As a user, I can disable, reorder, or delete learned rules and remove a manual correction.

## Requirements

### Activity details

- Add a dedicated `Activity Details` navigation item and page.
- Fetch raw-title details only when this page is opened.
- Show the actual recorded time range, a navigable timeline, and a chronological activity list.
- Support date navigation, search, and attribution filters.
- Selecting either a timeline block or list row must highlight the same interval and open its evidence panel.
- Explicitly represent loading, empty, filtered-empty, partial-data, and error states.

### Attribution

- One interval can belong to at most one project.
- Precedence is: manual correction > first enabled matching rule > confirmed Codex context > application/unclassified fallback.
- Rule priority is explicit array order; first match wins.
- Cross-application corrected/rule-matched time counts as project attention.
- Raw ActivityWatch events remain immutable.

### Manual correction

- A correction applies only to the selected active interval.
- The user can select a known project or create a local project name.
- A correction is reversible.
- The corrected summary and details must use the same classification engine.

### Rule learning

- A learned rule requires an exact application match plus a meaningful title condition.
- Supported title conditions are `contains` and `exact`; regex is intentionally excluded from this UI.
- New rules default to future-only via `appliesFrom` and never silently rewrite historical reports.
- Manual corrections always remain authoritative over rules.
- Rules support enable/disable, priority movement, and deletion.
- When the title is missing or too generic, the UI permits manual correction but does not offer rule creation.

### Persistence and compatibility

- Migrate persisted store version 3 to version 4 with empty rules, overrides, and manual projects.
- Existing settings, daily records, Codex samples, and aliases must be preserved.
- All new IPC contracts are typed in `src/shared/contracts.ts` and validated in the main process.

## Non-goals

- Editing ActivityWatch databases or deleting raw events.
- Automatic AI classification, regex authoring, bulk historical reassignment, or cloud sync.
- macOS collection support in this release.

## Acceptance criteria

- [ ] Activity details for a day are derived from ActivityWatch foreground events minus AFK time.
- [ ] Timeline and list selection stay synchronized and expose app/title evidence.
- [ ] A manual correction updates both details and dashboard summaries after refresh.
- [ ] Removing the correction restores rule/Codex/application fallback behavior.
- [ ] A learned rule does not affect intervals before `appliesFrom` and affects matching later intervals.
- [ ] Rule precedence, disable/delete, and priority movement are covered by tests.
- [ ] Store v3 data migrates losslessly to v4 defaults.
- [ ] UI covers normal, loading, empty, filtered-empty, partial, error, and conflict states.
- [ ] Typecheck, unit tests, renderer build, Electron package, installed smoke, and regression checks pass.

## Release copy

`v0.4.0 — 活动明细、人工纠错与归类规则学习`
