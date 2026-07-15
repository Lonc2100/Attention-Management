import type {
  ActivitySummary,
  DailyRecord,
  InsightHour,
  OutcomeEvidence,
  PersonalInsights,
  ProjectOption,
  TimelineSlice
} from './contracts'

export type InsightInputDay = {
  record: DailyRecord
  activity: ActivitySummary
}

function uniqueProjectKeys(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
}

export function buildOutcomeEvidence(record: DailyRecord, activity: ActivitySummary, knownProjects: ProjectOption[] = []): OutcomeEvidence[] {
  const projectSeconds = new Map<string, number>()
  for (const slice of activity.attentionSlices) {
    if (slice.kind !== 'project') continue
    projectSeconds.set(slice.key, (projectSeconds.get(slice.key) ?? 0) + slice.seconds)
  }
  const projectLabels = new Map(knownProjects.map((project) => [project.key, project.label]))
  for (const project of activity.projects) projectLabels.set(project.key, project.label)
  return record.outcomes.map((outcome) => {
    const keys = uniqueProjectKeys(outcome.projectKeys ?? [])
    return {
      outcomeId: outcome.id,
      title: outcome.title,
      priority: outcome.id === record.priorityOutcomeId,
      status: record.review?.outcomeStatuses[outcome.id] ?? 'pending',
      projectKeys: keys,
      projectLabels: keys.map((key) => projectLabels.get(key) ?? key),
      attentionSeconds: keys.reduce((total, key) => total + (projectSeconds.get(key) ?? 0), 0)
    }
  })
}

function categoryKey(slice: TimelineSlice): string {
  return `${slice.kind}:${slice.key}`
}

function contextSwitches(timeline: TimelineSlice[]): number {
  const active = timeline.filter((slice) => slice.kind !== 'afk').sort((a, b) => a.start.localeCompare(b.start))
  let switches = 0
  for (let index = 1; index < active.length; index += 1) {
    const previous = active[index - 1]
    const current = active[index]
    if (previous && current && categoryKey(previous) !== categoryKey(current)) switches += 1
  }
  return switches
}

function addTimelineToHours(timeline: TimelineSlice[], projectKeys: Set<string>, secondsByHour: Map<number, number>, daysByHour: Map<number, Set<string>>, date: string): void {
  for (const slice of timeline) {
    if (slice.kind !== 'project' || !projectKeys.has(slice.key)) continue
    let cursor = Date.parse(slice.start)
    const end = Date.parse(slice.end)
    if (!Number.isFinite(cursor) || !Number.isFinite(end) || end <= cursor) continue
    while (cursor < end) {
      const local = new Date(cursor)
      const hour = local.getHours()
      const boundary = new Date(local)
      boundary.setMinutes(0, 0, 0)
      boundary.setHours(boundary.getHours() + 1)
      const partEnd = Math.min(end, boundary.getTime())
      secondsByHour.set(hour, (secondsByHour.get(hour) ?? 0) + (partEnd - cursor) / 1000)
      const dates = daysByHour.get(hour) ?? new Set<string>()
      dates.add(date)
      daysByHour.set(hour, dates)
      cursor = partEnd
    }
  }
}

export function buildPersonalInsights(inputs: InsightInputDay[], requestedDays: 7 | 14 | 30): PersonalInsights {
  const ordered = [...inputs].sort((a, b) => b.record.date.localeCompare(a.record.date))
  const secondsByHour = new Map<number, number>()
  const daysByHour = new Map<number, Set<string>>()
  let qualifyingDays = 0
  const days = ordered.map(({ record, activity }) => {
    const evidence = buildOutcomeEvidence(record, activity)
    const priority = evidence.find((item) => item.priority)
    const priorityStatus = priority?.status ?? null
    const subjectiveScore = record.review?.subjectiveScore ?? null
    const qualifies = activity.connected && priorityStatus === 'done' && subjectiveScore !== null && subjectiveScore >= 4
      && Boolean(priority?.projectKeys.length) && (priority?.attentionSeconds ?? 0) > 0
    if (qualifies && priority) {
      qualifyingDays += 1
      addTimelineToHours(activity.timeline, new Set(priority.projectKeys), secondsByHour, daysByHour, record.date)
    }
    return {
      date: record.date,
      activeSeconds: activity.activeSeconds,
      priorityAttentionSeconds: priority?.attentionSeconds ?? 0,
      priorityStatus,
      subjectiveScore,
      contextSwitches: contextSwitches(activity.timeline),
      connected: activity.connected
    }
  })
  const candidateHours: InsightHour[] = qualifyingDays >= 3
    ? [...secondsByHour.entries()]
      .map(([hour, seconds]) => ({ hour, seconds, qualifyingDays: daysByHour.get(hour)?.size ?? 0 }))
      .filter((item) => item.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds || a.hour - b.hour)
      .slice(0, 3)
    : []
  const connectedDays = days.filter((day) => day.connected).length
  const quality = qualifyingDays < 3 ? 'insufficient' : connectedDays < days.length ? 'partial' : 'ready'
  const observations = quality === 'insufficient'
    ? ['至少 3 个“绝对优先成果完成、主观评分较高且存在关联项目注意力”的复盘日后，才会显示候选时段。']
    : [
      '候选时段来自完成结果与主观评分共同满足条件的历史日期，只表示相关性，不代表时间段本身造成高效率。',
      connectedDays < days.length ? '部分日期的 ActivityWatch 数据不可用，规律只使用已连接日期。' : '当前范围内的 ActivityWatch 日期均可读取。'
    ]
  const chronological = [...ordered].sort((a, b) => a.record.date.localeCompare(b.record.date))
  return {
    requestedDays,
    rangeStart: chronological[0]?.record.date ?? null,
    rangeEnd: chronological[chronological.length - 1]?.record.date ?? null,
    reviewedDays: days.filter((day) => day.subjectiveScore !== null).length,
    connectedDays,
    quality,
    candidateHours,
    days,
    observations,
    generatedAt: new Date().toISOString()
  }
}
