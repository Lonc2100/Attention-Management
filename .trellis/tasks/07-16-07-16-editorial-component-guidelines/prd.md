# Editorial component guideline adoption

## Goal

Translate the GSAP-inspired editorial rules into constrained desktop UI component tokens and pilot modules without copying marketing-scale layout.

## Requirements

- Preserve the established warm off-black canvas, cream text, outlined surfaces, and shadow-free depth model.
- Translate the five GSAP color disciplines into product semantics: green = attention/project, orange = unclassified, pink = review, violet = AI, blue = application/system data.
- Add a Mori-first font contract without claiming or bundling an unavailable commercial font; use explicit Chinese fallbacks.
- Keep component body and control text at 14px or larger, with 16px as the resting component rhythm.
- Render module annotations with the recurring visible `{ label }` signature.
- Provide governed ghost and primary gradient-outline pill buttons; do not introduce solid CTA fills.
- Provide a governed full-width hairline divider for feature blocks.
- Keep the dense desktop product scale: editorial hero titles may be enlarged, but must not copy the marketing site's 224px viewport-bleed treatment.
- Apply the new rules to the existing Personal Insights pilot through the shared component API only.
- Preserve all Personal Insights data, range selection, loading/error behavior, and responsive layout.

## Acceptance Criteria

- [x] Theme tokens expose a Mori-first font stack, 400/600 weights, 14/16/18/23px UI scale, and the five fixed discipline aliases.
- [x] `ModuleHeader` renders curly-bracket annotations and one of five finite discipline classes.
- [x] `PillButton` supports only ghost and primary gradient-outline variants using a native button.
- [x] `ModuleDivider` renders a semantic full-width hairline without page-owned styling.
- [x] Component CSS remains token-only, shadow-free, cream-on-dark, and contains no solid accent CTA fill.
- [x] Personal Insights demonstrates at least two discipline colors while retaining existing behavior.
- [x] Static contract tests prevent font, color-taxonomy, typography-floor, and button-style regressions.
- [x] Unit tests, type checks, production build, and Electron E2E pass.

## Non-goals

- Recreating the GSAP marketing homepage or its 224px hero layout.
- Restyling every legacy application page in one batch.
- Bundling or redistributing PP Mori without a user-supplied licensed font asset.
- Adding a sixth category color or using status colors as category taxonomy.
- Changing application data, IPC, persistence, or ActivityWatch behavior.
