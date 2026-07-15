# Change Brief

## Problem

The current dashboard aggregates attention but gives the user too little evidence to understand or correct a classification. This limits trust and prevents the system from learning stable cross-application project patterns.

## Current behavior

- ActivityWatch foreground and AFK events feed daily summaries.
- Confirmed Codex contexts split Codex time into projects.
- Other applications stay at application level.
- No detailed evidence view, manual correction, or learned rule store exists.

## Desired behavior

Provide an inspectable activity ledger with reversible interval corrections and conservative future-facing rules. The summary and detail page must share one classification source of truth.

## Risk boundaries

- Never mutate ActivityWatch raw data.
- Never retroactively change history without an explicit later feature.
- Keep raw window titles lazy-loaded and local.
- Preserve all existing v3 store data during migration.

## Data flow

Renderer Activity Details -> typed IPC -> ActivityWatch manager -> shared classifier -> details/summary -> renderer. Mutations flow through IPC into the local JSON store and then trigger a fresh classification.
