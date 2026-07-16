# v0.7.0 Implementation Plan

## Behavior slices

1. **Range facts**
   - Public interface: ActivityWatch manager range-duration method.
   - Red test: multiple daily periods map one-to-one to active seconds; query failure remains unavailable.
   - Boundary mock: HTTP fetch only.

2. **Pure aggregation and metrics**
   - Public interface: shared work-activity aggregation functions.
   - Red tests: daily→week/month total conservation; fixed levels; duplicate project links; 45-minute threshold; priority completion and confidence counts.
   - No internal mocks.

3. **Typed IPC**
   - Public interface: `window.timeEfficiency.getWorkActivity()`.
   - Red test: contract/channel exists and invalid/unavailable source is represented truthfully.
   - Boundary mock: ActivityWatch manager/store.

4. **Homepage module**
   - Public interface: rendered `TodayDashboard` behavior.
   - Red tests: module appears on homepage, daily/week/month selection updates cells and metrics, hover/focus tooltip works without mousemove, unavailable state is distinct.
   - Boundary mock: typed preload method only.

5. **Day drill-down**
   - Public interface: click a daily cell.
   - Red E2E/component test: activity details opens with selected date.
   - No internal mocks.

6. **Quiet widget**
   - Public interface: widget bounds and rendered widget.
   - Red tests: collapsed/expanded dimensions, clamping, compact content and non-focus-stealing behavior.
   - Boundary mock: Electron window in existing E2E only.

7. **Integration and release**
   - Update version, PRD registry, roadmap, release notes and README/use instructions.
   - Run all release gates and real upgrade.

## Ordered checklist

- [x] Add failing shared/query/widget tests.
- [x] Implement ActivityWatch Query API range adapter and cache.
- [x] Implement shared daily/week/month aggregation and period metrics.
- [x] Extend contracts, preload and main IPC.
- [x] Build the homepage Work Activity module and selected-date drill-down.
- [x] Recompose homepage spacing using existing page modules/tokens.
- [x] Shrink widget bounds and simplify component/CSS.
- [x] Run focused tests after each slice.
- [x] Run full unit tests, typecheck and build.
- [x] Run Electron E2E twice and inspect screenshots.
- [x] Build NSIS package and run package smoke.
- [x] Record real data/autostart baseline, install v0.7.0 over v0.6.2, verify preservation and version.
- [x] Update documentation and Trellis specs if new non-obvious knowledge was found.
- [ ] Commit work, archive task, commit bookkeeping, tag and push.

## Validation commands

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e
npm run dist
node tests/package-smoke.mjs
node tests/installed-autostart.mjs
```

Use the repository's actual script names if a listed smoke script differs; never report an unrun command as passed.

## Risk points

- ActivityWatch Query API response shape differs between bundled Python/Rust server versions.
- A year of cells becomes unreadable at narrow widths; use responsive cell sizing and horizontal month labels rather than shrinking text below the theme contract.
- Project attention can double-count when multiple outcomes link the same project; union keys per day.
- Transparent Electron windows may recreate black corners on Windows; use the documented opaque fallback.
- Real installer closes/restarts the app; snapshot data and autostart before installation.
