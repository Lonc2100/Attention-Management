# ActivityWatch v0.14.0b1 Isolated Evaluation

## Artifact

- Official GitHub release: `v0.14.0b1`, prerelease, published 2026-05-07.
- Windows x86_64 zip SHA-256: `1DABB452680A5FA215D7173F4885156B95329B94D3ED035FCF0BD8B8BD0EE108`.
- Evaluation used port `5601` and an isolated database under the task evidence directory. It did not read or write the real ActivityWatch database.

## Passed

- `aw-server-rust` identified itself as `v0.14.0-beta.1 (rust)` and served `/api/0/info`.
- `aw-watcher-window` and `aw-watcher-afk` both stayed running and created their required buckets.
- The product's `flood` / AFK intersection / `sum_durations` query returned active and observed seconds.
- Bucket metadata exposed fresh event bounds through `metadata.end` while `last_updated` was null. v0.7.2 now supports both representations.

## Harness Finding

The first attempt supplied a directory to `--dbpath` instead of a database file. The beta server opened its HTTP port but poisoned its datastore lock after the SQLite open failure. This was a harness error and was corrected to an isolated `sqlite.db` path. It also confirms why `/info` alone cannot be treated as collector health.

## Decision

Keep bundled ActivityWatch `v0.13.2` for v0.7.2. The beta passes an isolated compatibility smoke but remains a prerelease and has not passed this product's installer, upgrade, data-retention and multi-day soak gates. Re-evaluate a stable 0.14 release or later candidate without changing the runtime silently.
