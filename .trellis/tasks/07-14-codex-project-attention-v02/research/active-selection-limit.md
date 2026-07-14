# Active-selection boundary audit

## Confirmed official behavior

The Codex app-server README states that `recencyAt` is initialized when a thread is created and advances when a turn starts. Background output and other persisted mutations do not advance it. The protocol does not expose the desktop client's currently selected sidebar task.

## Consequence

An independent app-server process can reliably identify the most recently interaction-confirmed root thread. It cannot prove that the user merely clicked a different existing task and has not started a turn there.

## Decision

- v0.2 labels this signal “最近确认的 Codex 上下文”, not an absolute selected-tab claim.
- Starting a turn in another root task creates the new context transition automatically.
- Pure browse time after a silent task click remains assigned to the last confirmed context; this limitation is visible in the README and UI.
- Do not read Codex private databases or scrape localized desktop UI in production. Those approaches are brittle and lack a stable contract.
- Revisit when the official desktop/app-server surface exposes an active-selection event or identifier.
