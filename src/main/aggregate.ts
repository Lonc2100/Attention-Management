import type {
  ActivityEvent,
  ActivitySummary,
  AttentionSlice,
  AfkNote,
  AfkPeriod,
  AppUsage,
  CodexContextSample,
  CodexContextStatus,
  FocusSnapshot,
  ProjectUsage,
  TimelineSlice
} from '../shared/contracts'
import { identityForSample, isCodexWindow } from './project-attribution'

type TimeInterval = { start: number; end: number }

type ProjectAccumulator = {
  usage: ProjectUsage
  threadIds: Set<string>
  latestDetectedAt: number
}

type TimelineDraft = Omit<TimelineSlice, 'id' | 'start' | 'end' | 'seconds'> & TimeInterval
type ProjectLeaf = Pick<TimelineSlice, 'kind' | 'key' | 'label' | 'app' | 'classified'>

const EMPTY_CODEX_CONTEXT: CodexContextStatus = {
  available: false,
  foreground: false,
  active: false,
  provider: 'codex-app-server',
  current: null,
  lastDetectedAt: null,
  error: null
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start)
  const merged: TimeInterval[] = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (!last || interval.start > last.end) {
      merged.push({ ...interval })
      continue
    }
    last.end = Math.max(last.end, interval.end)
  }
  return merged
}

function subtractIntervals(start: number, end: number, excluded: TimeInterval[]): TimeInterval[] {
  let cursor = start
  const result: TimeInterval[] = []
  for (const interval of excluded) {
    if (interval.end <= cursor) continue
    if (interval.start >= end) break
    if (interval.start > cursor) result.push({ start: cursor, end: Math.min(interval.start, end) })
    cursor = Math.max(cursor, interval.end)
    if (cursor >= end) break
  }
  if (cursor < end) result.push({ start: cursor, end })
  return result
}

function seconds(intervals: TimeInterval[]): number {
  return intervals.reduce((total, interval) => total + (interval.end - interval.start) / 1000, 0)
}

function addProjectSeconds(
  projects: Map<string, ProjectAccumulator>,
  sample: CodexContextSample | null,
  durationSeconds: number,
  aliases: Record<string, string>
): ProjectLeaf {
  if (durationSeconds <= 0) {
    if (!sample) return { kind: 'codex-unclassified', key: 'unclassified', label: '待分类', app: 'Codex', classified: false }
    const identity = identityForSample(sample, aliases)
    return { kind: 'project', key: identity.key, label: identity.label, app: 'Codex', classified: true }
  }
  if (!sample) {
    const existing = projects.get('unclassified')
    if (existing) {
      existing.usage.seconds += durationSeconds
      return { kind: 'codex-unclassified', key: 'unclassified', label: '待分类', app: 'Codex', classified: false }
    }
    projects.set('unclassified', {
      usage: {
        key: 'unclassified',
        label: '待分类',
        seconds: durationSeconds,
        classified: false,
        identitySource: 'unclassified',
        threadCount: 0,
        latestThreadName: null,
        cwd: null
      },
      threadIds: new Set(),
      latestDetectedAt: 0
    })
    return { kind: 'codex-unclassified', key: 'unclassified', label: '待分类', app: 'Codex', classified: false }
  }

  const identity = identityForSample(sample, aliases)
  const existing = projects.get(identity.key)
  if (existing) {
    existing.usage.seconds += durationSeconds
    existing.threadIds.add(sample.threadId)
    existing.usage.threadCount = existing.threadIds.size
    if (sample.detectedAt >= existing.latestDetectedAt) {
      existing.latestDetectedAt = sample.detectedAt
      existing.usage.latestThreadName = sample.threadName
      existing.usage.cwd = sample.cwd
    }
    return { kind: 'project', key: identity.key, label: identity.label, app: 'Codex', classified: true }
  }

  projects.set(identity.key, {
    usage: {
      key: identity.key,
      label: identity.label,
      seconds: durationSeconds,
      classified: true,
      identitySource: identity.source,
      threadCount: 1,
      latestThreadName: sample.threadName,
      cwd: sample.cwd
    },
    threadIds: new Set([sample.threadId]),
    latestDetectedAt: sample.detectedAt
  })
  return { kind: 'project', key: identity.key, label: identity.label, app: 'Codex', classified: true }
}

function attributeInterval(
  interval: TimeInterval,
  samples: CodexContextSample[],
  projects: Map<string, ProjectAccumulator>,
  aliases: Record<string, string>,
  timeline: TimelineDraft[]
): void {
  let current: CodexContextSample | null = null
  for (const sample of samples) {
    if (sample.detectedAt <= interval.start) current = sample
    else break
  }

  let cursor = interval.start
  for (const transition of samples) {
    if (transition.detectedAt <= interval.start) continue
    if (transition.detectedAt >= interval.end) break
    const leaf = addProjectSeconds(projects, current, (transition.detectedAt - cursor) / 1000, aliases)
    timeline.push({ start: cursor, end: transition.detectedAt, ...leaf })
    current = transition
    cursor = transition.detectedAt
  }
  const leaf = addProjectSeconds(projects, current, (interval.end - cursor) / 1000, aliases)
  timeline.push({ start: cursor, end: interval.end, ...leaf })
}

function mergeTimeline(drafts: TimelineDraft[]): TimelineSlice[] {
  const sorted = drafts
    .filter((slice) => slice.end > slice.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: TimelineDraft[] = []
  for (const slice of sorted) {
    const last = merged[merged.length - 1]
    const sameLeaf = last
      && last.kind === slice.kind
      && last.key === slice.key
      && last.app === slice.app
      && slice.start >= last.end
      && slice.start - last.end <= 1
    if (sameLeaf) {
      last.end = Math.max(last.end, slice.end)
    } else {
      merged.push({ ...slice })
    }
  }
  return merged.map((slice) => ({
    id: `${slice.kind}:${slice.key}:${slice.start}:${slice.end}`,
    start: new Date(slice.start).toISOString(),
    end: new Date(slice.end).toISOString(),
    seconds: (slice.end - slice.start) / 1000,
    kind: slice.kind,
    key: slice.key,
    label: slice.label,
    app: slice.app,
    classified: slice.classified
  }))
}

function attentionFromTimeline(timeline: TimelineSlice[]): AttentionSlice[] {
  const leaves = new Map<string, AttentionSlice>()
  for (const slice of timeline) {
    if (slice.kind === 'afk') continue
    const mapKey = `${slice.kind}:${slice.key}`
    const existing = leaves.get(mapKey)
    if (existing) existing.seconds += slice.seconds
    else leaves.set(mapKey, {
      kind: slice.kind,
      key: slice.key,
      label: slice.label,
      app: slice.app,
      seconds: slice.seconds,
      classified: slice.classified
    })
  }
  return [...leaves.values()].sort((a, b) => b.seconds - a.seconds)
}

function focusFromActivity(
  tracking: boolean,
  timeline: TimelineSlice[],
  attention: AttentionSlice[],
  codexContext: CodexContextStatus,
  nowMs: number
): FocusSnapshot {
  if (!tracking) {
    return { status: 'paused', label: '记录已暂停', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 }
  }
  const containingAfk = [...timeline].reverse().find((slice) => slice.kind === 'afk'
    && new Date(slice.start).getTime() <= nowMs
    && new Date(slice.end).getTime() >= nowMs)
  if (containingAfk) {
    return {
      status: 'afk', label: '已离开电脑', projectKey: null, app: null,
      startedAt: containingAfk.start,
      continuousSeconds: Math.max(0, (nowMs - new Date(containingAfk.start).getTime()) / 1000),
      projectTodaySeconds: 0
    }
  }
  if (codexContext.foreground && codexContext.active) {
    const current = codexContext.current
    const key = current?.projectKey ?? 'unclassified'
    const status = current ? 'confirmed' : 'unclassified'
    const matching = [...timeline].reverse().find((slice) => slice.key === key && new Date(slice.end).getTime() >= nowMs - 60_000)
    const startedAt = matching?.start ?? (current ? new Date(current.detectedAt).toISOString() : null)
    return {
      status,
      label: current?.projectLabel ?? 'Codex · 待分类',
      projectKey: current?.projectKey ?? null,
      app: 'Codex',
      startedAt,
      continuousSeconds: startedAt ? Math.max(0, (nowMs - new Date(startedAt).getTime()) / 1000) : 0,
      projectTodaySeconds: attention.find((slice) => slice.key === key)?.seconds ?? 0
    }
  }
  if (codexContext.current) {
    return {
      status: 'recent',
      label: codexContext.current.projectLabel,
      projectKey: codexContext.current.projectKey,
      app: 'Codex',
      startedAt: null,
      continuousSeconds: 0,
      projectTodaySeconds: attention.find((slice) => slice.key === codexContext.current?.projectKey)?.seconds ?? 0
    }
  }
  const latest = [...timeline]
    .filter((slice) => slice.kind !== 'afk')
    .sort((a, b) => b.end.localeCompare(a.end))[0]
  if (latest && new Date(latest.end).getTime() >= nowMs - 60_000) {
    return {
      status: latest.kind === 'application' ? 'application' : latest.kind === 'codex-unclassified' ? 'unclassified' : 'confirmed',
      label: latest.label,
      projectKey: latest.kind === 'project' ? latest.key : null,
      app: latest.app,
      startedAt: latest.start,
      continuousSeconds: Math.max(0, (nowMs - new Date(latest.start).getTime()) / 1000),
      projectTodaySeconds: attention.find((slice) => slice.kind === latest.kind && slice.key === latest.key)?.seconds ?? 0
    }
  }
  return { status: 'idle', label: '等待开始', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 }
}

export function aggregateActivity(
  windowEvents: ActivityEvent[],
  afkEvents: ActivityEvent[],
  notes: AfkNote[],
  tracking: boolean,
  bucketIds: { window: string | null; afk: string | null },
  contextSamples: CodexContextSample[] = [],
  projectAliases: Record<string, string> = {},
  codexContext: CodexContextStatus = EMPTY_CODEX_CONTEXT,
  nowMs: number = Date.now()
): ActivitySummary {
  const currentAlias = codexContext.current ? projectAliases[codexContext.current.projectKey]?.trim() : ''
  const displayCodexContext: CodexContextStatus = currentAlias && codexContext.current
    ? {
        ...codexContext,
        current: {
          ...codexContext.current,
          projectLabel: currentAlias,
          identitySource: 'alias'
        }
      }
    : codexContext
  const afkPeriods: AfkPeriod[] = afkEvents
    .filter((event) => event.data.status === 'afk' && event.duration > 0)
    .map((event) => {
      const end = new Date(new Date(event.timestamp).getTime() + event.duration * 1000).toISOString()
      const note = notes.find((item) => item.start === event.timestamp || Math.abs(new Date(item.start).getTime() - new Date(event.timestamp).getTime()) < 1000)
      return { start: event.timestamp, end, seconds: event.duration, note: note?.note }
    })

  const afkIntervals = mergeIntervals(afkPeriods.map((period) => ({
    start: new Date(period.start).getTime(),
    end: new Date(period.end).getTime()
  })))
  const sortedSamples = [...contextSamples].sort((a, b) => a.detectedAt - b.detectedAt)
  const apps = new Map<string, { seconds: number; titles: Map<string, number> }>()
  const projects = new Map<string, ProjectAccumulator>()
  const timelineDrafts: TimelineDraft[] = afkIntervals.map((interval) => ({
    ...interval,
    kind: 'afk',
    key: 'afk',
    label: '离开电脑',
    app: null,
    classified: false
  }))
  let activeSeconds = 0
  let codexActiveSeconds = 0

  for (const event of windowEvents) {
    const start = new Date(event.timestamp).getTime()
    const end = start + event.duration * 1000
    const activeIntervals = subtractIntervals(start, end, afkIntervals)
    const active = seconds(activeIntervals)
    if (active <= 0) continue

    activeSeconds += active
    const app = event.data.app || '未知应用'
    const title = event.data.title || '无标题'
    const entry = apps.get(app) ?? { seconds: 0, titles: new Map<string, number>() }
    entry.seconds += active
    entry.titles.set(title, (entry.titles.get(title) ?? 0) + active)
    apps.set(app, entry)

    if (isCodexWindow(app, title)) {
      codexActiveSeconds += active
      for (const interval of activeIntervals) attributeInterval(interval, sortedSamples, projects, projectAliases, timelineDrafts)
    } else {
      for (const interval of activeIntervals) timelineDrafts.push({
        ...interval,
        kind: 'application',
        key: `app:${app.toLocaleLowerCase()}`,
        label: app,
        app,
        classified: true
      })
    }
  }

  const usage: AppUsage[] = [...apps.entries()]
    .map(([app, value]) => ({
      app,
      seconds: value.seconds,
      topTitles: [...value.titles.entries()]
        .map(([title, titleSeconds]) => ({ title, seconds: titleSeconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 3)
    }))
    .sort((a, b) => b.seconds - a.seconds)

  const projectUsage = [...projects.values()]
    .map((item) => item.usage)
    .sort((a, b) => b.seconds - a.seconds)
  const codexUnclassifiedSeconds = projectUsage
    .filter((item) => !item.classified)
    .reduce((total, item) => total + item.seconds, 0)
  const codexClassifiedSeconds = Math.max(0, codexActiveSeconds - codexUnclassifiedSeconds)
  const timeline = mergeTimeline(timelineDrafts)
  const attentionSlices = attentionFromTimeline(timeline)

  return {
    connected: true,
    tracking,
    windowBucketId: bucketIds.window,
    afkBucketId: bucketIds.afk,
    activeSeconds,
    afkSeconds: seconds(afkIntervals),
    apps: usage,
    projects: projectUsage,
    codexActiveSeconds,
    codexClassifiedSeconds,
    codexUnclassifiedSeconds,
    codexCoveragePercent: codexActiveSeconds > 0 ? Math.round((codexClassifiedSeconds / codexActiveSeconds) * 100) : 0,
    codexContext: displayCodexContext,
    timeline,
    attentionSlices,
    focus: focusFromActivity(tracking, timeline, attentionSlices, displayCodexContext, nowMs),
    afkPeriods: afkPeriods.sort((a, b) => b.start.localeCompare(a.start)),
    recentEvents: [...windowEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100),
    error: null,
    updatedAt: new Date().toISOString()
  }
}

export function disconnectedSummary(tracking: boolean, error: unknown): ActivitySummary {
  return {
    connected: false,
    tracking,
    windowBucketId: null,
    afkBucketId: null,
    activeSeconds: 0,
    afkSeconds: 0,
    apps: [],
    projects: [],
    codexActiveSeconds: 0,
    codexClassifiedSeconds: 0,
    codexUnclassifiedSeconds: 0,
    codexCoveragePercent: 0,
    codexContext: EMPTY_CODEX_CONTEXT,
    timeline: [],
    attentionSlices: [],
    focus: { status: 'disconnected', label: '采集服务未连接', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 },
    afkPeriods: [],
    recentEvents: [],
    error: error instanceof Error ? error.message : String(error),
    updatedAt: new Date().toISOString()
  }
}
