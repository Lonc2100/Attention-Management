import { describe, expect, it } from 'vitest'
import { buildOutcomeEvidence, buildPersonalInsights } from '../src/shared/outcome-insights'
import type { ActivitySummary, DailyRecord, TimelineSlice } from '../src/shared/contracts'

function record(date: string, score: number | null, priorityStatus: 'pending' | 'done' | 'partial' | 'dropped' = 'done'): DailyRecord {
  return {
    date,
    outcomes: [
      { id: 'priority', title: '交付成果闭环', projectKeys: ['project:one'] },
      { id: 'secondary', title: '整理复盘', projectKeys: ['project:one', 'project:two'] }
    ],
    priorityOutcomeId: 'priority',
    planCompletedAt: `${date}T00:30:00.000Z`,
    review: score === null ? null : {
      outcomeStatuses: { priority: priorityStatus, secondary: 'partial' },
      subjectiveScore: score,
      summary: '有结果',
      tomorrowIntent: '继续推进',
      completedAt: `${date}T14:00:00.000Z`
    },
    afkNotes: [],
    aiAnalysis: null
  }
}

function activity(timeline: TimelineSlice[]): ActivitySummary {
  const activeSeconds = timeline.filter((slice) => slice.kind !== 'afk').reduce((sum, slice) => sum + slice.seconds, 0)
  return {
    connected: true,
    tracking: true,
    windowBucketId: 'window',
    afkBucketId: 'afk',
    activeSeconds,
    afkSeconds: timeline.filter((slice) => slice.kind === 'afk').reduce((sum, slice) => sum + slice.seconds, 0),
    apps: [],
    projects: [
      { key: 'project:one', label: '时间效率助手', seconds: 0, classified: true, identitySource: 'folder', threadCount: 1, latestThreadName: null, cwd: null },
      { key: 'project:two', label: '自媒体', seconds: 0, classified: true, identitySource: 'folder', threadCount: 1, latestThreadName: null, cwd: null }
    ],
    codexActiveSeconds: 0,
    codexClassifiedSeconds: 0,
    codexUnclassifiedSeconds: 0,
    codexCoveragePercent: 100,
    codexContext: { available: true, foreground: false, active: false, provider: 'codex-app-server', current: null, lastDetectedAt: null, error: null },
    timeline,
    attentionSlices: [
      { kind: 'project', key: 'project:one', label: '时间效率助手', app: 'Codex.exe', seconds: timeline.filter((slice) => slice.kind === 'project' && slice.key === 'project:one').reduce((sum, slice) => sum + slice.seconds, 0), classified: true },
      { kind: 'application', key: 'project:one', label: '伪装成同键的应用', app: 'chrome.exe', seconds: 300, classified: true },
      { kind: 'codex-unclassified', key: 'unclassified', label: '待分类', app: 'Codex', seconds: 300, classified: false }
    ],
    focus: { status: 'idle', label: '等待开始', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 },
    afkPeriods: [],
    recentEvents: [],
    error: null,
    updatedAt: '2026-07-15T16:00:00.000Z'
  }
}

function slice(id: string, date: string, hour: number, minutes: number, kind: TimelineSlice['kind'], key: string): TimelineSlice {
  const start = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`)
  const end = new Date(start.getTime() + minutes * 60_000)
  return { id, start: start.toISOString(), end: end.toISOString(), seconds: minutes * 60, kind, key, label: key, app: kind === 'project' ? 'Codex.exe' : 'chrome.exe', classified: kind !== 'codex-unclassified' && kind !== 'afk' }
}

describe('outcome evidence', () => {
  it('counts only explicitly linked project leaves and never exposes a shared cross-outcome total', () => {
    const day = activity([
      slice('one', '2026-07-15', 9, 30, 'project', 'project:one'),
      slice('two', '2026-07-15', 10, 10, 'application', 'project:one'),
      slice('three', '2026-07-15', 11, 10, 'codex-unclassified', 'unclassified'),
      slice('four', '2026-07-15', 12, 10, 'afk', 'afk')
    ])
    const evidence = buildOutcomeEvidence(record('2026-07-15', 4), day)

    expect(evidence).toEqual([
      expect.objectContaining({ outcomeId: 'priority', attentionSeconds: 1800, projectLabels: ['时间效率助手'], priority: true }),
      expect.objectContaining({ outcomeId: 'secondary', attentionSeconds: 1800, projectLabels: ['时间效率助手', '自媒体'], priority: false })
    ])
    expect(evidence).not.toHaveProperty('totalAttentionSeconds')
  })
})

describe('personal insights', () => {
  it('does not treat high scores without linked project evidence as qualifying pattern days', () => {
    const days = ['2026-07-12', '2026-07-13', '2026-07-14'].map((date, index) => {
      const item = record(date, 5)
      item.outcomes[0].projectKeys = []
      return { record: item, activity: activity([slice(`p${index}`, date, 9, 30, 'project', 'project:one')]) }
    })
    const result = buildPersonalInsights(days, 7)
    expect(result.quality).toBe('insufficient')
    expect(result.candidateHours).toEqual([])
  })

  it('requires three qualifying reviewed days before exposing candidate high-quality hours', () => {
    const days = ['2026-07-13', '2026-07-14'].map((date, index) => ({
      record: record(date, 4),
      activity: activity([slice(`p${index}`, date, 9, 30, 'project', 'project:one')])
    }))
    const result = buildPersonalInsights(days, 7)
    expect(result.quality).toBe('insufficient')
    expect(result.candidateHours).toEqual([])
    expect(result.observations.join('')).toContain('至少 3')
  })

  it('derives candidate hours and context switches from reviewed evidence without a productivity score', () => {
    const days = ['2026-07-12', '2026-07-13', '2026-07-14'].map((date, index) => ({
      record: record(date, index === 2 ? 5 : 4),
      activity: activity([
        slice(`p${index}`, date, 9, 40, 'project', 'project:one'),
        slice(`a${index}`, date, 10, 10, 'application', 'app:chrome'),
        slice(`p2${index}`, date, 11, 20, 'project', 'project:one')
      ])
    }))
    const result = buildPersonalInsights(days, 7)

    expect(result.quality).toBe('ready')
    expect(result.reviewedDays).toBe(3)
    expect(result.candidateHours[0]).toMatchObject({ hour: 9, qualifyingDays: 3, seconds: 7200 })
    expect(result.days[0].contextSwitches).toBe(2)
    expect(result).not.toHaveProperty('productivityScore')
    expect(result.observations.join('')).toContain('相关')
  })
})
