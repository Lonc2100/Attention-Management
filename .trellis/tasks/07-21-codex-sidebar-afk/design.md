# Codex Sidebar Attribution + AFK Default Design

## First Harness-lite Extraction

```text
src/main/providers/codex-visible-context.ts
  Windows UI Automation -> VisibleCodexContext
             |
src/main/services/codex-attribution-service.ts
  foreground state + provider + app-server threads -> stored sample / status
             |
src/main/codex-context-tracker.ts
  compatibility wrapper and timer lifecycle
```

The renderer remains unchanged: it consumes only typed IPC data through preload.

## Provider Strategy

The provider scans only the foreground Codex document exposed through Windows UI Automation. It supports two layouts:

1. Top project strip: a visible `项目: <label>` / `Project: <label>` control with an adjacent visible title.
2. Project sidebar: a visible selected `ListItem` / `TreeItem` / `TabItem` with `SelectionItemPattern`. It supplies only a title; absence of a project label intentionally preserves duplicate-title rejection.

The provider returns one minimal `{ threadName, projectLabel, source }` record. It does not send clicks, keyboard input, screenshots, DOM contents, or conversation body text.

## Matching Strategy

Only exact normalized thread-name matches are candidates. A project label disambiguates by cwd basename. If zero or multiple candidates remain, return null and classify the interval as `codex-unclassified`.

## AFK Migration Rule

`DEFAULT_IDLE_THRESHOLD_MINUTES` becomes 5. The store migration already normalizes a persisted setting only when it is invalid; therefore existing valid user values remain unchanged. New settings use the new default.

## Validation Split

- Deterministic tests prove provider parsing, service behavior, and default/persistence compatibility.
- E2E proves the normal app starts with the new default in isolated test state.
- Real integration only claims success if the running Codex Desktop exposes a unique visible context and it maps to an app-server thread.
