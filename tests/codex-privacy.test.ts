import { describe, expect, it } from 'vitest'
import type { ActivitySummary, DailyRecord } from '../src/shared/contracts'
import { buildCodexReviewPayload } from '../src/main/codex'

describe('Codex review privacy boundary', () => {
  it('includes project aggregates but excludes thread ids, cwd, and titles', () => {
    const record: DailyRecord = {
      date: '2026-07-14', outcomes: [{ id: 'priority', title: '完成交付', projectKeys: ['cwd:secret'] }], priorityOutcomeId: 'priority', planCompletedAt: null,
      review: null, afkNotes: [], aiAnalysis: null
    }
    const activity = {
      connected: true, tracking: true, windowBucketId: 'window', afkBucketId: 'afk',
      activeSeconds: 600, afkSeconds: 0, softIdleSeconds: 0, idleThresholdMinutes: 15, codexActiveSeconds: 600,
      codexClassifiedSeconds: 600, codexUnclassifiedSeconds: 0, codexCoveragePercent: 100,
      projects: [{ key: 'cwd:secret', label: '自媒体创作', seconds: 600, classified: true as const, identitySource: 'folder' as const, threadCount: 1, latestThreadName: '绝密聊天标题', cwd: 'D:\\private\\secret' }],
      apps: [{ app: 'ChatGPT.exe', seconds: 600, topTitles: [{ title: '绝密窗口标题', seconds: 600 }] }],
      codexContext: { available: true, foreground: true, active: true, provider: 'codex-app-server' as const, current: { threadId: 'thread-secret-123', threadName: '绝密聊天标题', cwd: 'D:\\private\\secret', projectKey: 'cwd:secret', projectLabel: '自媒体创作', identitySource: 'folder' as const, detectedAt: 1 }, lastDetectedAt: 1, error: null },
      timeline: [{ id: 'one', start: '2026-07-14T01:00:00.000Z', end: '2026-07-14T01:10:00.000Z', seconds: 600, kind: 'project' as const, key: 'cwd:secret', label: '自媒体创作', app: 'ChatGPT.exe', classified: true }],
      attentionSlices: [{ kind: 'project' as const, key: 'cwd:secret', label: '自媒体创作', app: 'ChatGPT.exe', seconds: 600, classified: true }],
      focus: { status: 'confirmed' as const, label: '自媒体创作', projectKey: 'cwd:secret', app: 'ChatGPT.exe', startedAt: null, continuousSeconds: 600, projectTodaySeconds: 600 },
      afkPeriods: [], recentEvents: [], error: null, updatedAt: new Date().toISOString()
    } satisfies ActivitySummary

    const serialized = JSON.stringify(buildCodexReviewPayload(record, activity))
    expect(serialized).toContain('自媒体创作')
    expect(serialized).toContain('projectUsage')
    expect(serialized).toContain('attentionMinutes')
    expect(serialized).not.toContain('thread-secret-123')
    expect(serialized).not.toContain('D:\\\\private')
    expect(serialized).not.toContain('绝密聊天标题')
    expect(serialized).not.toContain('绝密窗口标题')
    expect(serialized).not.toContain('cwd:secret')
  })
})
