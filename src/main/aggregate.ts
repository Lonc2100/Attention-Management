import type {
  ActivityEvent,
  ActivityOverride,
  ActivityRule,
  ActivitySummary,
  AttentionSlice,
  AfkNote,
  AfkPeriod,
  AppUsage,
  CodexContextSample,
  CodexContextStatus,
  FocusSnapshot,
  ProjectIdentitySource,
  ProjectUsage,
  PrivacyRule,
  TimelineSlice
} from '../shared/contracts'
import { classifyActivityDay, type ClassifiedSegment } from './classification'
import { identityForSample, isCodexWindow } from './project-attribution'

type TimelineDraft = Omit<TimelineSlice, 'id' | 'start' | 'end' | 'seconds'> & { start: number; end: number }

const EMPTY_CODEX_CONTEXT: CodexContextStatus = {
  available: false,
  foreground: false,
  active: false,
  provider: 'codex-app-server',
  current: null,
  lastDetectedAt: null,
  error: null
}

function mergeTimeline(drafts: TimelineDraft[]): TimelineSlice[] {
  const merged: TimelineDraft[] = []
  for (const slice of drafts.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged[merged.length - 1]
    const sameLeaf = last
      && last.kind === slice.kind
      && last.key === slice.key
      && last.app === slice.app
      && slice.start >= last.end
      && slice.start - last.end <= 1
    if (sameLeaf) last.end = Math.max(last.end, slice.end)
    else merged.push({ ...slice })
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

function privacyMatches(rule: PrivacyRule, segment: ClassifiedSegment): boolean {
  if (!rule.enabled || rule.app.trim().toLocaleLowerCase() !== segment.app.trim().toLocaleLowerCase()) return false
  return segment.title.toLocaleLowerCase().includes(rule.titlePattern.trim().toLocaleLowerCase())
}

/** Keep duration while removing all identifying fields from our derived model. */
function applyPrivacyRules(segments: ClassifiedSegment[], rules: PrivacyRule[]): ClassifiedSegment[] {
  if (!rules.length) return segments
  return segments.map((segment) => {
    if (segment.attribution === 'afk' || !rules.some((rule) => privacyMatches(rule, segment))) return segment
    return {
      ...segment,
      app: '已隐藏活动',
      title: '',
      projectKey: null,
      projectLabel: '已隐藏活动',
      attribution: 'application',
      ruleId: null,
      overrideId: null,
      sample: null,
      classified: false,
      correctable: false
    }
  })
}

function timelineFromSegments(segments: ClassifiedSegment[]): TimelineSlice[] {
  return mergeTimeline(segments.map((segment) => {
    if (segment.attribution === 'afk') {
      return { start: segment.startMs, end: segment.endMs, kind: 'afk', key: 'afk', label: '离开电脑', app: null, classified: false }
    }
    if (segment.projectKey) {
      return { start: segment.startMs, end: segment.endMs, kind: 'project', key: segment.projectKey, label: segment.projectLabel, app: segment.app, classified: true }
    }
    if (segment.attribution === 'unclassified') {
      return { start: segment.startMs, end: segment.endMs, kind: 'codex-unclassified', key: 'unclassified', label: '待分类', app: 'Codex', classified: false }
    }
    return {
      start: segment.startMs,
      end: segment.endMs,
      kind: 'application',
      key: `app:${segment.app.toLocaleLowerCase()}`,
      label: segment.app,
      app: segment.app,
      classified: true
    }
  }))
}

function appUsageFromSegments(segments: ClassifiedSegment[]): AppUsage[] {
  const apps = new Map<string, { seconds: number; titles: Map<string, number> }>()
  for (const segment of segments) {
    if (segment.attribution === 'afk') continue
    const entry = apps.get(segment.app) ?? { seconds: 0, titles: new Map<string, number>() }
    entry.seconds += segment.seconds
    entry.titles.set(segment.title, (entry.titles.get(segment.title) ?? 0) + segment.seconds)
    apps.set(segment.app, entry)
  }
  return [...apps.entries()].map(([app, value]) => ({
    app,
    seconds: value.seconds,
    topTitles: [...value.titles.entries()]
      .map(([title, titleSeconds]) => ({ title, seconds: titleSeconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3)
  })).sort((a, b) => b.seconds - a.seconds)
}

function projectSource(
  key: string,
  samples: CodexContextSample[],
  aliases: Record<string, string>,
  manualProjects: Record<string, string>
): ProjectIdentitySource {
  if (manualProjects[key] || key.startsWith('manual:')) return 'manual'
  const sample = [...samples].reverse().find((item) => item.projectKey === key)
  if (!sample) return aliases[key] ? 'alias' : 'manual'
  return identityForSample(sample, aliases).source
}

function projectUsageFromSegments(
  segments: ClassifiedSegment[],
  samples: CodexContextSample[],
  aliases: Record<string, string>,
  manualProjects: Record<string, string>
): ProjectUsage[] {
  const result = new Map<string, ProjectUsage & { threadIds: Set<string>; latestDetectedAt: number }>()
  for (const segment of segments) {
    const key = segment.projectKey ?? (segment.attribution === 'unclassified' ? 'unclassified' : null)
    if (!key) continue
    const existing = result.get(key)
    if (existing) {
      existing.seconds += segment.seconds
      if (segment.sample) {
        existing.threadIds.add(segment.sample.threadId)
        existing.threadCount = existing.threadIds.size
        if (segment.sample.detectedAt >= existing.latestDetectedAt) {
          existing.latestDetectedAt = segment.sample.detectedAt
          existing.latestThreadName = segment.sample.threadName
          existing.cwd = segment.sample.cwd
        }
      }
      continue
    }
    const sample = segment.sample
    result.set(key, {
      key,
      label: key === 'unclassified' ? '待分类' : segment.projectLabel,
      seconds: segment.seconds,
      classified: key !== 'unclassified',
      identitySource: key === 'unclassified' ? 'unclassified' : projectSource(key, samples, aliases, manualProjects),
      threadCount: sample ? 1 : 0,
      latestThreadName: sample?.threadName ?? null,
      cwd: sample?.cwd ?? null,
      threadIds: new Set(sample ? [sample.threadId] : []),
      latestDetectedAt: sample?.detectedAt ?? 0
    })
  }
  return [...result.values()].map(({ threadIds: _threadIds, latestDetectedAt: _latestDetectedAt, ...usage }) => usage)
    .sort((a, b) => b.seconds - a.seconds)
}

function focusFromActivity(
  tracking: boolean,
  timeline: TimelineSlice[],
  attention: AttentionSlice[],
  codexContext: CodexContextStatus,
  nowMs: number,
  liveState?: { isAfk: boolean; fresh?: boolean; startedAt?: string | null }
): FocusSnapshot {
  if (!tracking) return { status: 'paused', label: '记录已暂停', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 }
  // The historical workday range deliberately ends at the last active event so
  // a main rest is never counted as work. Keep the live AFK signal separate so
  // the current-state card still tells the truth while the user is away.
  if (liveState?.fresh && liveState.isAfk) {
    const startedAt = liveState.startedAt ?? null
    return {
      status: 'afk', label: '已离开电脑', projectKey: null, app: null, startedAt,
      continuousSeconds: startedAt ? Math.max(0, (nowMs - Date.parse(startedAt)) / 1000) : 0,
      projectTodaySeconds: 0
    }
  }
  const containingAfk = [...timeline].reverse().find((slice) => slice.kind === 'afk'
    && Date.parse(slice.start) <= nowMs && Date.parse(slice.end) >= nowMs)
  if (containingAfk) return {
    status: 'afk', label: '已离开电脑', projectKey: null, app: null, startedAt: containingAfk.start,
    continuousSeconds: Math.max(0, (nowMs - Date.parse(containingAfk.start)) / 1000), projectTodaySeconds: 0
  }

  const latest = [...timeline].filter((slice) => slice.kind !== 'afk').sort((a, b) => b.end.localeCompare(a.end))[0]
  if (latest && Date.parse(latest.end) >= nowMs - 60_000 && latest.kind === 'project') {
    return {
      status: 'confirmed', label: latest.label, projectKey: latest.key, app: latest.app,
      startedAt: latest.start, continuousSeconds: Math.max(0, (nowMs - Date.parse(latest.start)) / 1000),
      projectTodaySeconds: attention.find((slice) => slice.kind === 'project' && slice.key === latest.key)?.seconds ?? 0
    }
  }
  if (codexContext.foreground && codexContext.active) {
    const current = codexContext.current
    const key = current?.projectKey ?? 'unclassified'
    const matching = [...timeline].reverse().find((slice) => slice.key === key && Date.parse(slice.end) >= nowMs - 60_000)
    const startedAt = matching?.start ?? (current ? new Date(current.detectedAt).toISOString() : null)
    return {
      status: current ? 'confirmed' : 'unclassified', label: current?.projectLabel ?? 'Codex · 待分类',
      projectKey: current?.projectKey ?? null, app: 'Codex', startedAt,
      continuousSeconds: startedAt ? Math.max(0, (nowMs - Date.parse(startedAt)) / 1000) : 0,
      projectTodaySeconds: attention.find((slice) => slice.key === key)?.seconds ?? 0
    }
  }
  if (codexContext.current) return {
    status: 'recent', label: codexContext.current.projectLabel, projectKey: codexContext.current.projectKey,
    app: 'Codex', startedAt: null, continuousSeconds: 0,
    projectTodaySeconds: attention.find((slice) => slice.key === codexContext.current?.projectKey)?.seconds ?? 0
  }
  if (latest && Date.parse(latest.end) >= nowMs - 60_000) return {
    status: latest.kind === 'application' ? 'application' : latest.kind === 'codex-unclassified' ? 'unclassified' : 'confirmed',
    label: latest.label, projectKey: latest.kind === 'project' ? latest.key : null, app: latest.app,
    startedAt: latest.start, continuousSeconds: Math.max(0, (nowMs - Date.parse(latest.start)) / 1000),
    projectTodaySeconds: attention.find((slice) => slice.kind === latest.kind && slice.key === latest.key)?.seconds ?? 0
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
  nowMs: number = Date.now(),
  rules: ActivityRule[] = [],
  overrides: ActivityOverride[] = [],
  manualProjects: Record<string, string> = {},
  privacyRules: PrivacyRule[] = [],
  liveState?: { isAfk: boolean; fresh?: boolean; startedAt?: string | null }
): ActivitySummary {
  const currentAlias = codexContext.current ? projectAliases[codexContext.current.projectKey]?.trim() : ''
  const displayCodexContext: CodexContextStatus = currentAlias && codexContext.current
    ? { ...codexContext, current: { ...codexContext.current, projectLabel: currentAlias, identitySource: 'alias' } }
    : codexContext
  const classified = classifyActivityDay(windowEvents, afkEvents, contextSamples, projectAliases, rules, overrides, manualProjects)
  const privacySafeSegments = applyPrivacyRules(classified.segments, privacyRules)
  const afkPeriods: AfkPeriod[] = classified.afkPeriods.map((period) => ({
    ...period,
    note: notes.find((item) => item.start === period.start || Math.abs(Date.parse(item.start) - Date.parse(period.start)) < 1000)?.note
  })).sort((a, b) => b.start.localeCompare(a.start))
  const timeline = timelineFromSegments(privacySafeSegments)
  const attentionSlices = attentionFromTimeline(timeline)
  const projects = projectUsageFromSegments(privacySafeSegments, contextSamples, projectAliases, manualProjects)
  const codexSegments = privacySafeSegments.filter((segment) => segment.attribution !== 'afk' && isCodexWindow(segment.app, segment.title))
  const codexActiveSeconds = codexSegments.reduce((total, segment) => total + segment.seconds, 0)
  const codexUnclassifiedSeconds = codexSegments.filter((segment) => segment.attribution === 'unclassified').reduce((total, segment) => total + segment.seconds, 0)
  const codexClassifiedSeconds = Math.max(0, codexActiveSeconds - codexUnclassifiedSeconds)

  return {
    connected: true,
    tracking,
    windowBucketId: bucketIds.window,
    afkBucketId: bucketIds.afk,
    activeSeconds: classified.activeSeconds,
    afkSeconds: classified.afkSeconds,
    apps: appUsageFromSegments(privacySafeSegments),
    projects,
    codexActiveSeconds,
    codexClassifiedSeconds,
    codexUnclassifiedSeconds,
    codexCoveragePercent: codexActiveSeconds > 0 ? Math.round((codexClassifiedSeconds / codexActiveSeconds) * 100) : 0,
    codexContext: displayCodexContext,
    timeline,
    attentionSlices,
    focus: focusFromActivity(tracking, timeline, attentionSlices, displayCodexContext, nowMs, liveState),
    afkPeriods,
    recentEvents: [...windowEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100),
    error: null,
    updatedAt: new Date().toISOString()
  }
}

export function disconnectedSummary(tracking: boolean, error: unknown): ActivitySummary {
  return {
    connected: false, tracking, windowBucketId: null, afkBucketId: null, activeSeconds: 0, afkSeconds: 0,
    apps: [], projects: [], codexActiveSeconds: 0, codexClassifiedSeconds: 0, codexUnclassifiedSeconds: 0,
    codexCoveragePercent: 0, codexContext: EMPTY_CODEX_CONTEXT, timeline: [], attentionSlices: [],
    focus: { status: 'disconnected', label: '采集服务未连接', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 },
    afkPeriods: [], recentEvents: [], error: error instanceof Error ? error.message : String(error), updatedAt: new Date().toISOString()
  }
}
