export const DEFAULT_MAIN_REST_MS = 6 * 60 * 60 * 1000

export interface ActiveInterval {
  start: number
  end: number
}

export interface WorkdayBoundary {
  workdayKey: string
  at: number
  source: 'initial' | 'auto' | 'manual'
}

export interface WorkdayAllocation extends ActiveInterval {
  workdayKey: string
}

export interface WorkdayModel {
  boundaries: WorkdayBoundary[]
  allocations: WorkdayAllocation[]
}

function localDateKey(timestamp: number): string {
  const value = new Date(timestamp)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeIntervals(intervals: ActiveInterval[]): ActiveInterval[] {
  const sorted = intervals
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
    .sort((a, b) => a.start - b.start)
  const merged: ActiveInterval[] = []
  for (const interval of sorted) {
    const previous = merged.at(-1)
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

function manualBoundaries(overrides: Record<string, string>): WorkdayBoundary[] {
  return Object.entries(overrides).flatMap(([workdayKey, value]) => {
    const at = Date.parse(value)
    return Number.isFinite(at) ? [{ workdayKey, at, source: 'manual' as const }] : []
  })
}

/**
 * Builds user-facing workdays from non-AFK foreground activity.
 * A date gets at most one automatic boundary: the first return on that date
 * after a main rest. Later daytime breaks cannot create another workday.
 */
export function buildWorkdayModel(
  input: ActiveInterval[],
  overrides: Record<string, string> = {},
  mainRestMs = DEFAULT_MAIN_REST_MS
): WorkdayModel {
  const intervals = normalizeIntervals(input)
  if (!intervals.length) return { boundaries: manualBoundaries(overrides).sort((a, b) => a.at - b.at), allocations: [] }

  const manual = manualBoundaries(overrides)
  const manualDates = new Set(manual.map((item) => item.workdayKey))
  const byDate = new Map<string, WorkdayBoundary>()
  const first = intervals[0]!
  const firstKey = localDateKey(first.start)
  if (!manualDates.has(firstKey)) byDate.set(firstKey, { workdayKey: firstKey, at: first.start, source: 'initial' })

  let previousEnd = first.end
  for (const interval of intervals.slice(1)) {
    const workdayKey = localDateKey(interval.start)
    const gap = interval.start - previousEnd
    if (gap >= mainRestMs && !manualDates.has(workdayKey) && !byDate.has(workdayKey)) {
      byDate.set(workdayKey, { workdayKey, at: interval.start, source: 'auto' })
    }
    previousEnd = Math.max(previousEnd, interval.end)
  }

  for (const boundary of manual) byDate.set(boundary.workdayKey, boundary)
  const boundaries = [...byDate.values()].sort((a, b) => a.at - b.at)
  const allocations: WorkdayAllocation[] = []

  for (const interval of intervals) {
    const cuts = boundaries.filter((boundary) => boundary.at > interval.start && boundary.at < interval.end)
    let cursor = interval.start
    for (const boundary of cuts) {
      const owner = [...boundaries].reverse().find((item) => item.at <= cursor)
      if (owner && boundary.at > cursor) allocations.push({ workdayKey: owner.workdayKey, start: cursor, end: boundary.at })
      cursor = boundary.at
    }
    const owner = [...boundaries].reverse().find((item) => item.at <= cursor)
    if (owner && interval.end > cursor) allocations.push({ workdayKey: owner.workdayKey, start: cursor, end: interval.end })
  }

  return { boundaries, allocations }
}

export function workdayRange(model: WorkdayModel, workdayKey: string): { start: number; end: number } | null {
  const index = model.boundaries.findIndex((boundary) => boundary.workdayKey === workdayKey)
  if (index < 0) return null
  const start = model.boundaries[index]!.at
  const end = model.allocations
    .filter((allocation) => allocation.workdayKey === workdayKey)
    .reduce((latest, allocation) => Math.max(latest, allocation.end), start)
  return end > start ? { start, end } : null
}

export function currentWorkdayKey(model: WorkdayModel, now = Date.now()): string | null {
  return [...model.boundaries].reverse().find((boundary) => boundary.at <= now)?.workdayKey ?? null
}
