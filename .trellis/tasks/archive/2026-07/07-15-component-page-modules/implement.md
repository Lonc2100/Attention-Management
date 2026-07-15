# Implementation plan

1. Add failing tests for module exports, semantic server rendering, finite variants, token-only CSS, and Personal Insights adoption.
2. Implement renderer UI module components and one component stylesheet.
3. Import the component stylesheet from the central CSS entry point.
4. Migrate Personal Insights without changing its data or interaction logic.
5. Run targeted tests, full unit tests, type checks, production build, and E2E.
6. Capture the component-composition rule in the frontend CSS spec.
7. Commit, archive the Trellis task, and record the session.

## Rollback Point

No persistent state changes. Revert the single work commit if the module contract causes visual or accessibility regressions.
