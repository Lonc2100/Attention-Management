# v0.5.0 Implementation Plan

1. [x] Add failing store migration and outcome-evidence unit tests.
2. [x] Implement shared contracts, v5 normalization, project-option bootstrap, and pure evidence calculation.
3. [x] Add failing multi-day pattern tests, then implement 7/14/30-day insights IPC.
4. [x] Add failing E2E expectations for project links, priority evidence, review evidence, and personal-insights states.
5. [x] Implement plan/dashboard/review/insights UI with localized CSS changes.
6. [x] Extend the privacy-tested Codex payload with outcome evidence.
7. [x] Run Unit -> typecheck -> build -> E2E; fix by root cause.
8. [x] Run two final E2E rounds, package smoke, real upgrade, data/autostart checks.
9. [x] Update README, roadmap, PRD registry, release/test reports and version metadata.
10. [ ] Full-scope review, Trellis archive, commit, tag and push.

## Behavior-slice rule

Each item starts with one observable failing test through a public function or user surface, followed by the smallest green implementation and refactor while green.
