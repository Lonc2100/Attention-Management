# v0.7.0 Verification

## Automated gates

- Focused TDD: 7/7 tests passed for range query, aggregation/metrics and widget bounds.
- Full unit suite: 61 passed; 3 opt-in integration tests skipped by design.
- TypeScript: node and renderer typechecks passed.
- Production build: passed.
- Electron E2E: two consecutive frozen-code rounds passed, 17 checks each.
- Packaged smoke: bundled ActivityWatch v0.13.2 and diagnostics passed.
- Installed autostart: disabling removed the Windows Run value; enabling restored the installed executable with `--hidden`.

## Real upgrade

- Before: installed FileVersion `0.6.2`, schema `6`, records on 2026-07-14/15/16, context samples on the same dates, launch-at-login enabled.
- Installer: `release/TimeEfficiency-0.7.0-Setup-x64.exe`.
- After: installed FileVersion `0.7.0`, schema remains `6`, all three record dates and context dates retained, launch-at-login remains enabled, installed application starts successfully in hidden mode.
- Package SHA-256: `826CCA15F078DE39E135FEE054C33BB60F158041C2BA55DAF4E7B72FF4BE3911`.
- Authenticode: `NotSigned`; this remains a local Windows beta, not a trusted public release.

## Visual inspection

- 1600×1000 homepage screenshot shows the work activity graph and six compact period metrics before the attention distribution.
- Daily cells retain readable size with horizontal overflow contained inside the module.
- Expanded widget is 268×150; collapsed bounds are 252×48. The opaque rectangular surface avoids the prior transparent black-corner artifact.

## Truthfulness checks

- Work activity is labeled as non-AFK foreground computer input, not productivity.
- Unavailable data is not rendered as a valid zero.
- Result attention unions linked project keys per day to prevent double counting.
- No screen recording, keystroke body capture, paid API, data deletion or privacy-boundary expansion was introduced.
