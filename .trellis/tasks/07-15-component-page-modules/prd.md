# Component governed page modules

## Goal

Make component-level UI rules the source of truth for page construction so future pages are assembled from constrained modules instead of inventing complete-page styling.

## Requirements

- Provide a small renderer UI module API for surfaces, section headers, metric cards, and segmented controls.
- Every module variant must have an explicit semantic role and a fixed class contract.
- Component styles must consume semantic design tokens only; no raw hexadecimal colors in the component stylesheet.
- Preserve semantic HTML and keyboard-accessible native controls.
- Migrate the Personal Insights page as the first low-risk proof slice.
- Preserve all existing Personal Insights data, loading, error, range-selection, and responsive behavior.
- Keep other pages visually and structurally unchanged in this task.
- Document the rule that page-level code may compose modules but may not redefine foundational surface, header, metric, or control styling.

## Acceptance Criteria

- [x] `PageModule`, `ModuleHeader`, `MetricModule`, `MetricGrid`, and `SegmentedControl` are exported from one renderer UI entry point.
- [x] Module variants and density choices are finite and visible in generated class names.
- [x] The component stylesheet contains no raw hex colors and is imported after the theme foundation.
- [x] Personal Insights uses the governed modules instead of direct `panel`, `panel-head`, `eyebrow`, and `range-switch` composition.
- [x] Server-rendered component tests verify semantic elements, variants, and active segmented-control state.
- [x] A static contract test prevents raw component colors and verifies the pilot page consumes the module API.
- [x] Unit tests, type checks, production build, and E2E pass.

## Observable Behavior Slices

1. **Module contract:** render each UI module in isolation and observe stable semantic markup and class variants.
2. **Pilot page:** open Personal Insights, switch 7/14/30-day ranges, and observe the same content and behavior through governed modules.
3. **Boundary:** no main-process, IPC, database, ActivityWatch, or persisted-data code changes.

## Out of Scope

- Redesigning the full dashboard or activity-details page.
- Creating a general-purpose external component library.
- Adding Storybook or a new UI dependency.
- Migrating every legacy selector in one batch.
- Inventing new data visualizations or product behavior.

## Notes

- The user explicitly selected component-governed composition and rejected freeform whole-page generation.
