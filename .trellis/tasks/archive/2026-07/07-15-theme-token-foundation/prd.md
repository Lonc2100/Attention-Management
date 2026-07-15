# Theme token foundation

## Goal

Turn the selected visual language into an enforceable renderer theme foundation so future UI work uses a stable, project-owned token vocabulary instead of adding more hard-coded colors, spacing, typography, and radii.

## Requirements

- Use CSS Custom Properties because the renderer does not currently include Tailwind CSS.
- Keep the product's selected temperament: calm order, flowing attention, private rather than supervisory.
- Use a GSAP-inspired dark canvas: near-black surfaces, warm cream primary text, hairline structure, and restrained chromatic accents.
- Preserve the supplied Electric Lime and warm neutral source values, but expose semantic aliases for actual component use.
- Color must encode meaning rather than decorate: confirmed attention, application activity, uncertain attribution, AFK, warning, and error need stable semantic tokens.
- Replace invalid range-like values such as `80-120px` with explicit minimum, default, and maximum tokens.
- Introduce one renderer CSS entry point that loads tokens before the existing stylesheet.
- Migrate the global canvas, typography, structural surfaces, primary controls, and current-focus primitives to semantic tokens as the first adoption slice.
- Do not perform a full visual redesign in this task and do not change application behavior or persisted data.

## Acceptance Criteria

- [x] A dedicated token stylesheet defines primitive and semantic color, typography, spacing, layout, radius, surface, and motion tokens.
- [x] The renderer imports a single CSS entry point that loads the token layer before legacy component styles.
- [x] No token contains an invalid CSS interval value.
- [x] Core application styles visibly consume semantic tokens for the page canvas, primary text, panels, borders, primary accent, and focus state.
- [x] A contract test fails if the token entry point is disconnected or required semantic tokens are removed.
- [x] Unit tests, type checks, and production build pass.

## Observable Behavior Slice

- **Public interface:** the rendered Electron UI CSS cascade.
- **Input/action:** launch or build the renderer after the theme layer is added.
- **Expected outcome:** the existing UI remains functional while global surfaces, typography, and primary focus controls resolve through semantic variables.
- **Boundary:** no main-process, IPC, ActivityWatch, database, or user-data behavior is modified.

## Out of Scope

- Full page-by-page visual redesign.
- Theme switching or a light-mode preference.
- Bundling or licensing the proprietary OTSono or Mori font files.
- Recoloring every historical visualization segment in one pass.
- Tailwind installation solely to host tokens.

## Notes

- The user explicitly approved implementation and delegated conservative defaults in the request.
- The existing v1 public-release gate task remains in progress and is intentionally separate from this UI foundation task.
