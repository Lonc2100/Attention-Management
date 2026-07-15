# Decision Log

| Date | Decision | Reason | Consequence |
| --- | --- | --- | --- |
| 2026-07-15 | Use a dedicated Activity Details page | Data inspection must not be mixed with planning/review | Adds one sidebar item and a focused workflow |
| 2026-07-15 | Choose three-pane investigation layout | Best balance of time context, density, and evidence | Desktop-first responsive layout |
| 2026-07-15 | Manual override > rule > Codex > app | Explicit user intent must be authoritative | One shared classifier is required |
| 2026-07-15 | Learned rules are future-only | Prevent silent historical report drift | Correction handles the selected past interval separately |
| 2026-07-15 | No regex authoring in v0.4.0 | Safer and understandable for daily use | Advanced rule editor may follow later |
| 2026-07-15 | Lazy-load raw titles | Reduce unnecessary exposure and IPC payload | Separate details API |
