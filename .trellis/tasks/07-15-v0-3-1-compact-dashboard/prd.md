# v0.3.1 compact attention dashboard interactions

## Goal

Make the Today page a distribution-first attention dashboard that shows the day's time allocation and chronological activity within the first viewport, while making chart colors directly understandable through linked hover interactions. Redesign the floating widget as a compact, polished focus companion.

## Requirements

- Compress the Today header, due reminder, current focus context, and summary metrics so they support rather than displace the attention distribution.
- At 1440x900 and larger, show the complete attention distribution and timeline without scrolling.
- Replace the CSS-only donut with targetable interactive segments without adding a charting dependency.
- Use one tooltip contract across donut segments, legend rows, and timeline segments. Show label, type, duration, percentage, and timeline start/end where applicable.
- Link hover and keyboard focus across the donut, legend, and timeline: the matching category remains prominent and unrelated categories dim.
- Keep Codex projects in the green family, unclassified time amber, applications in a distinct palette, and AFK gray/hatched.
- Use subtle 160-220ms transitions, no layout shift, and honor `prefers-reduced-motion`.
- Redesign the floating widget around current context and continuous focus time, with a compact collapsed pill and a smaller expanded panel.
- Preserve existing capture, attribution, storage, plan/review, privacy, widget placement, always-on-top, no-focus-steal, and ActivityWatch behavior.
- Do not add runtime dependencies or migrate persisted data.

## Acceptance Criteria

- [ ] At 1440x900 and 1600x1000, the Today screenshot includes the complete distribution panel and timeline before the first scroll.
- [ ] Hovering or keyboard-focusing a donut segment, legend row, or timeline segment shows an immediate custom tooltip and linked highlighting.
- [ ] Tooltip text identifies category, duration, percentage, and start/end for timeline slices; it stays inside the viewport.
- [ ] Very narrow timeline slices remain targetable through an enlarged hit area.
- [ ] Long labels truncate without breaking layout and expose the full value through the custom tooltip.
- [ ] Collapsed and expanded widget states render without empty/form-like space and preserve lifecycle behavior.
- [ ] Typecheck, unit tests, build, E2E screenshots, and packaged smoke tests pass.

## Out of Scope

- Changes to ActivityWatch ingestion, Codex project attribution, cross-application project inference, AI review, or reminder scheduling.
- New report periods, manual time entry, or macOS support.
