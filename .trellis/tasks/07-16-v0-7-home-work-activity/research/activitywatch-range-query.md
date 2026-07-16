# ActivityWatch range query evidence

## Sources

- Official REST API: https://docs.activitywatch.net/en/latest/api/rest.html
- Official data guide: https://docs.activitywatch.net/en/latest/examples/working-with-data.html
- Bundled ActivityWatch web UI query generator under `runtime/activitywatch/.../static/js`.

## Reusable pattern

The official web UI builds canonical active time with:

```text
events = flood(query_bucket(window_bucket));
not_afk = flood(query_bucket(afk_bucket));
not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
events = filter_period_intersect(events, not_afk);
RETURN = sum_durations(events);
```

The Query API accepts an array of time periods and evaluates the fixed query once per period. A read-only local probe against the bundled server on 2026-07-16 returned two daily duration results for two supplied periods, confirming compatibility with the installed runtime.

## Decision

Use the fixed server-side query for the 366-day actual-computer-input series. Do not accept arbitrary query text from the renderer. Do not fall back to hundreds of raw event requests if the range query fails; show an explicit unavailable state.
