/**
 * The widget shows rounded whole-minute durations.  Its percentage must use
 * the same visible units, otherwise a mathematically precise ratio can look
 * wrong next to the displayed times (for example 18 min / 5 h 23 min).
 */
export function roundedWidgetMinutes(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60))
}

export function widgetSharePercent(projectSeconds: number, activeSeconds: number): number {
  const activeMinutes = roundedWidgetMinutes(activeSeconds)
  if (!activeMinutes) return 0
  return Math.min(100, Math.round((roundedWidgetMinutes(projectSeconds) / activeMinutes) * 100))
}
