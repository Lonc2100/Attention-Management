import type { ActivityEvent, IdleOverride } from './contracts'

export const DEFAULT_IDLE_THRESHOLD_MINUTES = 15

export interface TimeInterval {
  start: number
  end: number
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const merged: TimeInterval[] = []
  for (const interval of intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1)
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

export function subtractIntervals(source: TimeInterval[], excluded: TimeInterval[]): TimeInterval[] {
  const cuts = mergeIntervals(excluded)
  const result: TimeInterval[] = []
  for (const interval of mergeIntervals(source)) {
    let cursor = interval.start
    for (const cut of cuts) {
      if (cut.end <= cursor) continue
      if (cut.start >= interval.end) break
      if (cut.start > cursor) result.push({ start: cursor, end: Math.min(cut.start, interval.end) })
      cursor = Math.max(cursor, cut.end)
      if (cursor >= interval.end) break
    }
    if (cursor < interval.end) result.push({ start: cursor, end: interval.end })
  }
  return result
}

export function intersectIntervals(left: TimeInterval[], right: TimeInterval[]): TimeInterval[] {
  const a = mergeIntervals(left)
  const b = mergeIntervals(right)
  const result: TimeInterval[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i]!.start, b[j]!.start)
    const end = Math.min(a[i]!.end, b[j]!.end)
    if (end > start) result.push({ start, end })
    if (a[i]!.end <= b[j]!.end) i += 1
    else j += 1
  }
  return result
}

export function intervalsFromEvents(events: ActivityEvent[]): TimeInterval[] {
  return mergeIntervals(events.flatMap((event) => {
    const start = Date.parse(event.timestamp)
    const end = start + Number(event.duration) * 1000
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start, end }] : []
  }))
}

export function idleOverrideIntervals(overrides: IdleOverride[]): TimeInterval[] {
  return mergeIntervals(overrides.flatMap((override) => {
    const start = Date.parse(override.start)
    const end = Date.parse(override.end)
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start, end }] : []
  }))
}

/** Separates raw keyboard/mouse inactivity from product-level major absence. */
export function classifyIdleIntervals(
  afkEvents: ActivityEvent[],
  thresholdMinutes: number,
  overrides: IdleOverride[] = []
): { hard: TimeInterval[]; soft: TimeInterval[]; overridden: TimeInterval[] } {
  const thresholdSeconds = Math.max(3, thresholdMinutes) * 60
  const afk = afkEvents.filter((event) => event.data.status === 'afk' && event.duration > 0)
  const hardRaw = intervalsFromEvents(afk.filter((event) => event.duration >= thresholdSeconds))
  const soft = intervalsFromEvents(afk.filter((event) => event.duration < thresholdSeconds))
  const overridden = intersectIntervals(hardRaw, idleOverrideIntervals(overrides))
  return { hard: subtractIntervals(hardRaw, overridden), soft, overridden }
}

export function intervalSeconds(intervals: TimeInterval[]): number {
  return intervals.reduce((total, item) => total + (item.end - item.start) / 1000, 0)
}
