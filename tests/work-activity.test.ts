import { describe, expect, it } from 'vitest'
import type { ActivitySummary, DailyRecord } from '../src/shared/contracts'
import {
  aggregateWorkActivity,
  buildWorkPeriodMetrics,
  workActivityLevel,
  type DailyWorkActivity
} from '../src/shared/work-activity'

function fact(date: string, hours: number, available = true): DailyWorkActivity {
  return { date, activeSeconds: hours * 3600, observedSeconds: hours * 3600, available }
}

function record(date: string): DailyRecord {
  return {
    date,
    outcomes: [
      { id: 'priority', title: '交付首页', projectKeys: ['project:one'] },
      { id: 'secondary', title: '整理文档', projectKeys: ['project:one', 'project:two'] }
    ],
    priorityOutcomeId: 'priority',
    planCompletedAt: `${date}T01:00:00.000Z`,
    review: {
      outcomeStatuses: { priority: 'done', secondary: 'partial' },
      subjectiveScore: 4,
      summary: '完成',
      tomorrowIntent: '继续',
      completedAt: `${date}T12:00:00.000Z`
    },
    afkNotes: [],
    aiAnalysis: null
  }
}

function activity(): ActivitySummary {
  return {
    connected: true,
    tracking: true,
    windowBucketId: 'window',
    afkBucketId: 'afk',
    activeSeconds: 7200,
    afkSeconds: 0,
    apps: [],
    projects: [],
    codexActiveSeconds: 0,
    codexClassifiedSeconds: 0,
    codexUnclassifiedSeconds: 0,
    codexCoveragePercent: 100,
    codexContext: { available: true, foreground: false, active: false, provider: 'codex-app-server', current: null, lastDetectedAt: null, error: null },
    timeline: [
      { id: 'long', start: '2026-07-16T01:00:00.000Z', end: '2026-07-16T01:45:00.000Z', seconds: 2700, kind: 'project', key: 'project:one', label: '项目一', app: 'Codex.exe', classified: true },
      { id: 'short', start: '2026-07-16T02:00:00.000Z', end: '2026-07-16T02:44:59.000Z', seconds: 2699, kind: 'project', key: 'project:two', label: '项目二', app: 'Codex.exe', classified: true }
    ],
    attentionSlices: [
      { kind: 'project', key: 'project:one', label: '项目一', app: 'Codex.exe', seconds: 1000, classified: true },
      { kind: 'project', key: 'project:two', label: '项目二', app: 'Codex.exe', seconds: 500, classified: true },
      { kind: 'application', key: 'app:chrome.exe', label: 'Chrome', app: 'chrome.exe', seconds: 5700, classified: true }
    ],
    focus: { status: 'idle', label: '等待活动', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 },
    afkPeriods: [],
    recentEvents: [],
    error: null,
    updatedAt: '2026-07-16T12:00:00.000Z'
  }
}

describe('work activity aggregation', () => {
  it('keeps daily facts and conserves totals when grouping by week and month', () => {
    const daily = [
      fact('2026-06-29', 1), fact('2026-06-30', 2), fact('2026-07-01', 3),
      fact('2026-07-02', 4), fact('2026-07-03', 5), fact('2026-07-04', 0), fact('2026-07-05', 1)
    ]

    const week = aggregateWorkActivity(daily, 'week')
    const month = aggregateWorkActivity(daily, 'month')

    expect(week).toHaveLength(1)
    expect(week[0]).toMatchObject({ startDate: '2026-06-29', endDate: '2026-07-05', activeSeconds: 16 * 3600, activeDays: 6, available: true })
    expect(month.map((cell) => [cell.key, cell.activeSeconds])).toEqual([
      ['2026-06', 3 * 3600],
      ['2026-07', 13 * 3600]
    ])
    expect(month.reduce((sum, cell) => sum + cell.activeSeconds, 0)).toBe(week[0]?.activeSeconds)
  })

  it('uses fixed levels and never treats unavailable as a zero-activity level', () => {
    expect(workActivityLevel(0, 'day', true)).toBe(0)
    expect(workActivityLevel(2 * 3600, 'day', true)).toBe(1)
    expect(workActivityLevel(4 * 3600, 'day', true)).toBe(2)
    expect(workActivityLevel(6 * 3600, 'day', true)).toBe(3)
    expect(workActivityLevel(6 * 3600 + 1, 'day', true)).toBe(4)
    expect(workActivityLevel(0, 'day', false)).toBeNull()
  })

  it('unions result-linked projects and counts only 45-minute confirmed project blocks', () => {
    const metrics = buildWorkPeriodMetrics([{ record: record('2026-07-16'), activity: activity() }], 'day')

    expect(metrics.resultAttentionSeconds).toBe(1500)
    expect(metrics.periodDays).toBe(1)
    expect(metrics.resultAttentionPercent).toBe(21)
    expect(metrics.longFocusCount).toBe(1)
    expect(metrics.priorityCompleted).toBe(1)
    expect(metrics.priorityPlanned).toBe(1)
    expect(metrics.reviewedDays).toBe(1)
    expect(metrics.linkedOutcomeDays).toBe(1)
  })
})
