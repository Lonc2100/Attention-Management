# Competitor Pattern Research

## Timing

Timing separates inspectable activities/time entries from rules. Its rules can be scoped to future activities and use priority, which supports a stable-history default. We adopt explicit priority and future-only creation.

Source: https://timingapp.com/help/rules

## ActivityWatch

ActivityWatch categories use regular expressions and deepest-match categorization. This is powerful but too technical for the primary correction flow, so v0.4.0 exposes guided app + title matching and keeps regex out of the UI.

Source: https://docs.activitywatch.net/en/latest/features/categorization.html

## ManicTime

ManicTime autotags are dynamic and historical reports can change after rule changes. Its documentation recommends fixed copies when historical stability matters. This supports storing manual corrections as durable overrides and avoiding automatic retroactive rules.

Source: https://docs.manictime.com/win-client/autotagging

## Resulting defaults

- Manual correction is durable and reversible.
- Learned rules are future-only.
- First enabled matching rule wins.
- One interval has one project.
- Rule authoring uses exact app plus title contains/exact.
