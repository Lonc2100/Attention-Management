# Component-governed page modules

## Boundary

This task adds a renderer-only presentation layer. It does not change domain types, application state, IPC, persistence, or native Electron behavior.

## Component Contract

```text
Page
├─ PageModule(default | hero | data | state; compact | comfortable)
│  └─ ModuleHeader(eyebrow, title, description, action)
├─ MetricGrid
│  └─ MetricModule(label, value, note)
└─ SegmentedControl(options, active value, onChange)
```

The module API owns semantic structure and class generation. Pages own content, ordering, data binding, and domain-specific visualization internals.

## Styling Contract

- `styles/components/page-modules.css` owns all foundational module visuals.
- It consumes semantic variables from `tokens.css` and never repeats primitive color literals.
- `styles/index.css` loads it after the legacy compatibility layer, allowing migrated pages to be governed without a full legacy rewrite.
- Page-specific CSS may size internal charts and tables but must not redefine module surfaces, radii, header typography, or base controls.

## Pilot Migration

Personal Insights is the first migration because it exercises all module types while carrying no write path. Existing query, range state, evidence calculations, and responsive layout remain in `InsightsView.tsx`.

## Compatibility and Rollback

The legacy classes remain available for unmigrated pages. Rollback is limited to restoring the Insights markup and removing the new stylesheet import; no data migration is involved.
