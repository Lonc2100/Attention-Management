# Technical Design

## Layout

The Today route uses a compact command header followed by a single-line reminder/context/metric rail. The attention distribution panel then occupies the primary top position, with the timeline immediately below it. Detail tables stay below the first viewport.

The global header becomes route-aware: Today uses the compact command-header treatment; form and settings routes retain a larger page heading.

## Interaction Model

`TodayDashboard` owns a single `activeKey` and tooltip state. Category identity is the existing stable `kind:key` pair.

- Donut: dependency-free SVG circles with `strokeDasharray` and `strokeDashoffset`, one focusable transparent hit circle and one visible circle per category.
- Legend: focusable buttons using the same category key.
- Timeline: focusable buttons positioned by recorded start/end and using the same category key.
- Tooltip: a fixed overlay positioned from pointer coordinates or the focused element rectangle, clamped to the viewport.
- Linked state: elements whose key matches `activeKey` receive the active modifier; unrelated elements receive the dimmed modifier.

The timeline tooltip adds start/end; the aggregate tooltip omits them. AFK slices remain in the timeline but are not part of the active-time donut denominator.

## Motion and Accessibility

Transitions are limited to opacity, transform, stroke width, and box-shadow. Interactive chart targets use semantic buttons or keyboard-focusable SVG elements with accessible labels. `prefers-reduced-motion` disables transitions.

## Floating Widget

Keep the existing IPC and persistence contracts. Change only renderer structure/CSS and the expanded window dimensions. Collapsed size remains compact; expanded size shrinks from 336x278 to approximately 324x206 while retaining drag, expand/collapse, open, hide, position clamping, and focus behavior.

## Compatibility and Rollback

No shared contract or stored setting changes. The renderer and window-size diff can be reverted independently without data migration.
