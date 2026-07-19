import type {
  ActivitySummary,
  DailyRecord,
  DailyWorkActivity,
  WorkActivityCell,
  WorkActivityMode,
  WorkPeriodMetrics
} from './contracts'

export type { DailyWorkActivity, WorkActivityCell, WorkActivityMode, WorkPeriodMetrics } from './contracts'

export interface WorkPeriodInput {
  record: DailyRecord
  activity: ActivitySummary
}

function localDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function dateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function periodFor(date: string, mode: WorkActivityMode): { key: string; startDate: string; endDate: string } {
  if (mode === 'day') return { key: date, startDate: date, endDate: date }
  const value = localDate(date)
  if (mode === 'month') {
    const start = new Date(value.getFullYear(), value.getMonth(), 1, 12)
    const end = new Date(value.getFullYear(), value.getMonth() + 1, 0, 12)
    return { key: date.slice(0, 7), startDate: dateKey(start), endDate: dateKey(end) }
  }
  const mondayOffset = (value.getDay() + 6) % 7
  const start = new Date(value)
  start.setDate(start.getDate() - mondayOffset)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { key: dateKey(start), startDate: dateKey(start), endDate: dateKey(end) }
}

export function aggregateWorkActivity(facts: DailyWorkActivity[], mode: WorkActivityMode): WorkActivityCell[] {
  const groups = new Map<string, WorkActivityCell>()
  for (const fact of [...facts].sort((a, b) => a.date.localeCompare(b.date))) {
    const period = periodFor(fact.date, mode)
    const current = groups.get(period.key) ?? {
      ...period,
      activeSeconds: 0,
      activeDays: 0,
      available: false
    }
    if (fact.available) {
      current.available = true
      current.activeSeconds += Math.max(0, fact.activeSeconds)
      if (fact.activeSeconds > 0) current.activeDays += 1
    }
    groups.set(period.key, current)
  }
  const cells = [...groups.values()].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return mode === 'month' ? cells.slice(-12) : cells
}

const LEVEL_THRESHOLDS: Record<WorkActivityMode, [number, number, number]> = {
  day: [2 * 3600, 4 * 3600, 6 * 3600],
  week: [10 * 3600, 20 * 3600, 30 * 3600],
  month: [40 * 3600, 80 * 3600, 120 * 3600]
}

export function workActivityLevel(seconds: number, mode: WorkActivityMode, available: boolean): number | null {
  if (!available) return null
  if (seconds <= 0) return 0
  const [low, medium, high] = LEVEL_THRESHOLDS[mode]
  if (seconds <= low) return 1
  if (seconds <= medium) return 2
  if (seconds <= high) return 3
  return 4
}

export function buildWorkPeriodMetrics(inputs: WorkPeriodInput[], _mode: WorkActivityMode): WorkPeriodMetrics {
  let activeSeconds = 0
  let resultAttentionSeconds = 0
  let longFocusCount = 0
  let priorityCompleted = 0
  let priorityPlanned = 0
  let reviewedDays = 0
  let linkedOutcomeDays = 0
  let latestLeaveAt: string | null = null
  let latestLeaveWorkday: string | null = null
  let latestLeaveOffset = Number.NEGATIVE_INFINITY

  for (const { record, activity } of inputs) {
    activeSeconds += Math.max(0, activity.activeSeconds)
    const linkedProjects = new Set(record.outcomes.flatMap((outcome) => outcome.projectKeys))
    if (linkedProjects.size > 0) linkedOutcomeDays += 1
    resultAttentionSeconds += activity.attentionSlices
      .filter((slice) => slice.kind === 'project' && linkedProjects.has(slice.key))
      .reduce((sum, slice) => sum + Math.max(0, slice.seconds), 0)
    longFocusCount += activity.timeline.filter((slice) => slice.kind === 'project' && slice.seconds >= 45 * 60).length
    if (record.priorityOutcomeId) {
      priorityPlanned += 1
      if (record.review?.outcomeStatuses[record.priorityOutcomeId] === 'done') priorityCompleted += 1
    }
    if (record.review) reviewedDays += 1
    const lastActive = activity.timeline
      .filter((slice) => slice.kind !== 'afk')
      .sort((a, b) => b.end.localeCompare(a.end))[0]?.end
    if (lastActive) {
      const offset = Date.parse(lastActive) - new Date(`${record.date}T00:00:00`).getTime()
      if (Number.isFinite(offset) && offset > latestLeaveOffset) {
        latestLeaveOffset = offset
        latestLeaveAt = lastActive
        latestLeaveWorkday = record.date
      }
    }
  }

  return {
    periodDays: inputs.length,
    activeSeconds,
    averageActiveSeconds: inputs.length > 0 ? Math.round(activeSeconds / inputs.length) : 0,
    resultAttentionSeconds,
    resultAttentionPercent: activeSeconds > 0 ? Math.round(resultAttentionSeconds / activeSeconds * 100) : 0,
    longFocusCount,
    priorityCompleted,
    priorityPlanned,
    reviewedDays,
    linkedOutcomeDays,
    latestLeaveAt,
    latestLeaveWorkday
  }
}
