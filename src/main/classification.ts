import type {
  ActivityDetailEntry,
  ActivityEvent,
  ActivityOverride,
  ActivityRule,
  AfkPeriod,
  CodexContextSample,
  IdleOverride
} from '../shared/contracts'
import {
  classifyIdleIntervals,
  intersectIntervals,
  intervalSeconds,
  intervalsFromEvents,
  subtractIntervals,
  type TimeInterval
} from '../shared/idle-policy'
import { identityForSample, isCodexWindow } from './project-attribution'

export interface ClassifiedSegment extends ActivityDetailEntry {
  startMs: number
  endMs: number
  sample: CodexContextSample | null
}

export interface ClassifiedActivityDay {
  segments: ClassifiedSegment[]
  entries: ActivityDetailEntry[]
  afkPeriods: AfkPeriod[]
  activeSeconds: number
  afkSeconds: number
  softIdleSeconds: number
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function ruleMatches(rule: ActivityRule, app: string, title: string, at: number): boolean {
  if (!rule.enabled || at < rule.appliesFrom || normalized(rule.app) !== normalized(app)) return false
  const pattern = normalized(rule.titlePattern)
  const actual = normalized(title)
  if (!pattern) return false
  return rule.titleMatch === 'exact' ? actual === pattern : actual.includes(pattern)
}

function projectLabel(
  key: string,
  aliases: Record<string, string>,
  manualProjects: Record<string, string>,
  samples: CodexContextSample[]
): string {
  const direct = manualProjects[key]?.trim() || aliases[key]?.trim()
  if (direct) return direct
  const sample = [...samples].reverse().find((item) => item.projectKey === key)
  if (sample) return sample.projectLabel
  return key.replace(/^[^:]+:/, '') || '未命名项目'
}

function sampleAt(samples: CodexContextSample[], at: number): CodexContextSample | null {
  let current: CodexContextSample | null = null
  for (const sample of samples) {
    if (sample.detectedAt > at) break
    current = sample
  }
  return current
}

function overrideAt(overrides: ActivityOverride[], app: string, title: string, start: number, end: number): ActivityOverride | null {
  return overrides.find((item) => {
    const overrideStart = Date.parse(item.start)
    const overrideEnd = Date.parse(item.end)
    return normalized(item.app) === normalized(app)
      && item.title === title
      && overrideStart < end
      && overrideEnd > start
  }) ?? null
}

function idleOverrideAt(overrides: IdleOverride[], start: number, end: number): IdleOverride | null {
  return overrides.find((item) => Date.parse(item.start) <= start && Date.parse(item.end) >= end) ?? null
}

function publicEntry(segment: ClassifiedSegment): ActivityDetailEntry {
  const { startMs: _startMs, endMs: _endMs, sample: _sample, ...entry } = segment
  return entry
}

function mergeSegments(segments: ClassifiedSegment[]): ClassifiedSegment[] {
  const sorted = segments.filter((item) => item.endMs > item.startMs).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const merged: ClassifiedSegment[] = []
  for (const segment of sorted) {
    const last = merged[merged.length - 1]
    const same = last
      && last.endMs === segment.startMs
      && last.app === segment.app
      && last.title === segment.title
      && last.projectKey === segment.projectKey
      && last.attribution === segment.attribution
      && last.ruleId === segment.ruleId
      && last.overrideId === segment.overrideId
      && last.idleOverrideId === segment.idleOverrideId
    if (same) {
      last.endMs = segment.endMs
      last.end = segment.end
      last.seconds = (last.endMs - last.startMs) / 1000
      last.id = `${last.app}:${last.startMs}:${last.endMs}`
    } else merged.push({ ...segment })
  }
  return merged
}

export function classifyActivityDay(
  windowEvents: ActivityEvent[],
  afkEvents: ActivityEvent[],
  contextSamples: CodexContextSample[] = [],
  projectAliases: Record<string, string> = {},
  rules: ActivityRule[] = [],
  overrides: ActivityOverride[] = [],
  manualProjects: Record<string, string> = {},
  idleThresholdMinutes = 15,
  idleOverrides: IdleOverride[] = []
): ClassifiedActivityDay {
  const samples = [...contextSamples].sort((a, b) => a.detectedAt - b.detectedAt)
  const idle = classifyIdleIntervals(afkEvents, idleThresholdMinutes, idleOverrides)
  const afkIntervals = idle.hard
  const afkPeriods: AfkPeriod[] = afkIntervals.map((item) => ({
    start: new Date(item.start).toISOString(),
    end: new Date(item.end).toISOString(),
    seconds: (item.end - item.start) / 1000
  }))
  const softIdleSeconds = intervalSeconds(intersectIntervals(intervalsFromEvents(windowEvents), idle.soft))
  const drafts: ClassifiedSegment[] = afkIntervals.map((item) => ({
    id: `afk:${item.start}:${item.end}`,
    start: new Date(item.start).toISOString(),
    end: new Date(item.end).toISOString(),
    seconds: (item.end - item.start) / 1000,
    app: '',
    title: '离开电脑',
    projectKey: null,
    projectLabel: '离开电脑',
    attribution: 'afk',
    ruleId: null,
    overrideId: null,
    idleOverrideId: null,
    classified: false,
    correctable: true,
    startMs: item.start,
    endMs: item.end,
    sample: null
  }))

  for (const event of windowEvents) {
    const eventStart = Date.parse(event.timestamp)
    const eventEnd = eventStart + event.duration * 1000
    const app = event.data.app?.trim() || '未知应用'
    const title = event.data.title?.trim() || '无标题'
    for (const active of subtractIntervals([{ start: eventStart, end: eventEnd }], afkIntervals)) {
      const boundaries = new Set<number>([active.start, active.end])
      for (const override of overrides) {
        if (normalized(override.app) !== normalized(app) || override.title !== title) continue
        const start = Date.parse(override.start)
        const end = Date.parse(override.end)
        if (start > active.start && start < active.end) boundaries.add(start)
        if (end > active.start && end < active.end) boundaries.add(end)
      }
      for (const rule of rules) {
        if (rule.appliesFrom > active.start && rule.appliesFrom < active.end) boundaries.add(rule.appliesFrom)
      }
      for (const idleOverride of idleOverrides) {
        const start = Date.parse(idleOverride.start)
        const end = Date.parse(idleOverride.end)
        if (start > active.start && start < active.end) boundaries.add(start)
        if (end > active.start && end < active.end) boundaries.add(end)
      }
      if (isCodexWindow(app, title)) {
        for (const sample of samples) {
          if (sample.detectedAt > active.start && sample.detectedAt < active.end) boundaries.add(sample.detectedAt)
        }
      }
      const points = [...boundaries].sort((a, b) => a - b)
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index]
        const end = points[index + 1]
        if (start === undefined || end === undefined || end <= start) continue
        const manual = overrideAt(overrides, app, title, start, end)
        const idleManual = idleOverrideAt(idleOverrides, start, end)
        const rule = manual ? null : rules.find((item) => ruleMatches(item, app, title, start)) ?? null
        const sample = !manual && !rule && isCodexWindow(app, title) ? sampleAt(samples, start) : null
        let projectKey: string | null = null
        let label = app
        let attribution: ActivityDetailEntry['attribution'] = 'application'
        if (manual) {
          projectKey = manual.projectKey
          label = projectLabel(projectKey, projectAliases, manualProjects, samples)
          attribution = 'manual'
        } else if (rule) {
          projectKey = rule.projectKey
          label = projectLabel(projectKey, projectAliases, manualProjects, samples)
          attribution = 'rule'
        } else if (sample) {
          const identity = identityForSample(sample, projectAliases)
          projectKey = identity.key
          label = identity.label
          attribution = 'codex-context'
        } else if (isCodexWindow(app, title)) {
          label = 'Codex · 待分类'
          attribution = 'unclassified'
        }
        drafts.push({
          id: `${event.id}:${start}:${end}`,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          seconds: (end - start) / 1000,
          app,
          title,
          projectKey,
          projectLabel: label,
          attribution,
          ruleId: rule?.id ?? null,
          overrideId: manual?.id ?? null,
          idleOverrideId: idleManual?.id ?? null,
          classified: projectKey !== null,
          correctable: true,
          startMs: start,
          endMs: end,
          sample
        })
      }
    }
  }

  const segments = mergeSegments(drafts)
  const activeSeconds = segments.filter((item) => item.attribution !== 'afk').reduce((total, item) => total + item.seconds, 0)
  const afkSeconds = afkIntervals.reduce((total, item) => total + (item.end - item.start) / 1000, 0)
  return { segments, entries: segments.map(publicEntry), afkPeriods, activeSeconds, afkSeconds, softIdleSeconds }
}
