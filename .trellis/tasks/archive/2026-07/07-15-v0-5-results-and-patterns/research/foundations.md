# v0.5 Foundations Research

Date: 2026-07-15

## Sources

1. ActivityWatch official data guide: https://docs.activitywatch.net/en/latest/examples/working-with-data.html
2. ActivityWatch API reference: https://docs.activitywatch.net/en/latest/api.html
3. ActivityWatch official repository: https://github.com/ActivityWatch/activitywatch
4. ActivityWatch Web UI Work Report implementation: https://github.com/ActivityWatch/aw-webui/commit/83dc881
5. Super Productivity official repository: https://github.com/super-productivity/super-productivity
6. Super Productivity releases: https://github.com/super-productivity/super-productivity/releases

## Assessment

| Foundation | Applicability | Freshness | Authority | Maturity | Decision |
|---|---|---|---|---|---|
| ActivityWatch canonical events | Very high: AFK-aware historical activity is our fact base | Official docs crawled July 2026; v0.14 beta exists while bundled stable remains v0.13.2 | Official docs/repo | Long-running cross-platform project | Keep bundled v0.13.2 for this version; reuse current equivalent AFK/classification pipeline |
| aw-webui Work Report | High: daily ranges, sessions, AFK guards and export-ready structure | Feature landed April 2026 | Official UI repo | New feature, but built on established query primitives | Borrow daily breakdown, explicit unsupported/partial states and bounded ranges; do not copy multi-device/export yet |
| Super Productivity | Medium: tasks linked to projects, plan-vs-actual review and personal metrics | Active 2026 releases | Official MIT repo | About 19k stars and hundreds of releases | Borrow explicit task/project linkage and review framing; reject manual timer as primary evidence |

## Findings

- ActivityWatch recommends processed canonical events because they combine AFK filtering, activity merging and categorization. Raw events require extra care and dry-run safety.
- The existing app already performs the critical canonical semantics locally: window/AFK intersection, conservative classification and mutually exclusive timeline leaves. A second query engine would create drift.
- ActivityWatch's newer Work Report validates on-demand 7/30-day breakdowns and explicit AFK-bucket guards. This supports a bounded historical query rather than an analytics database in v0.5.
- Super Productivity keeps tasks, projects, time and review close together. The transferable idea is explicit task/project context and plan-vs-actual evidence, not requiring the user to start timers.
- No mature source supports inferring “efficiency” from computer duration alone. v0.5 therefore combines user outcome status and subjective score with confirmed project attention, labels results as candidates/correlations, and enforces a minimum sample count.

## Product Boundary

The differentiator remains automatic, evidence-preserving project attention plus outcome review. We will not become a generic todo timer or duplicate ActivityWatch's category/report engine.

