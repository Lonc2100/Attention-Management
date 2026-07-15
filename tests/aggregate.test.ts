import { describe, expect, it } from 'vitest'
import { aggregateActivity } from '../src/main/aggregate'
import type { ActivityEvent, CodexContextSample, CodexContextStatus } from '../src/shared/contracts'

describe('ActivityWatch aggregation', () => {
  it('subtracts AFK overlap from window time and does not label AFK as inefficient', () => {
    const windows: ActivityEvent[] = [
      { id: 1, timestamp: '2026-07-14T01:00:00.000Z', duration: 600, data: { app: 'Code.exe', title: '重要项目' } },
      { id: 2, timestamp: '2026-07-14T01:10:00.000Z', duration: 300, data: { app: 'chrome.exe', title: '文档' } }
    ]
    const afk: ActivityEvent[] = [
      { id: 3, timestamp: '2026-07-14T01:05:00.000Z', duration: 300, data: { status: 'afk' } }
    ]
    const result = aggregateActivity(windows, afk, [], true, { window: 'window', afk: 'afk' })
    expect(result.activeSeconds).toBe(600)
    expect(result.afkSeconds).toBe(300)
    expect(result.apps[0]).toMatchObject({ app: 'Code.exe', seconds: 300 })
    expect(result.timeline.map((slice) => [slice.kind, slice.seconds])).toEqual([
      ['application', 300],
      ['afk', 300],
      ['application', 300]
    ])
    expect(result.attentionSlices.reduce((total, slice) => total + slice.seconds, 0)).toBe(result.activeSeconds)
    expect(result).not.toHaveProperty('efficiencyScore')
  })

  it('attaches a user-authored offline note to the matching AFK period', () => {
    const timestamp = '2026-07-14T02:00:00.000Z'
    const result = aggregateActivity(
      [],
      [{ id: 1, timestamp, duration: 900, data: { status: 'afk' } }],
      [{ id: timestamp, start: timestamp, end: '2026-07-14T02:15:00.000Z', note: '散步和思考方案' }],
      true,
      { window: null, afk: 'afk' }
    )
    expect(result.afkPeriods[0].note).toBe('散步和思考方案')
  })

  it('splits Codex attention into project leaves without double counting the Codex parent', () => {
    const start = Date.parse('2026-07-14T03:00:00.000Z')
    const samples: CodexContextSample[] = [
      {
        detectedAt: start,
        threadId: 'thread-one',
        threadName: '时间效率助手',
        cwd: 'D:\\codex work\\Attention-Management',
        recencyAt: start,
        source: 'vscode',
        projectKey: 'cwd:attention-management',
        projectLabel: 'Attention-Management',
        identitySource: 'folder'
      },
      {
        detectedAt: start + 300_000,
        threadId: 'thread-two',
        threadName: 'AI 口播',
        cwd: 'D:\\自媒体\\AI口播',
        recencyAt: start + 300_000,
        source: 'vscode',
        projectKey: 'cwd:ai-video',
        projectLabel: 'AI口播',
        identitySource: 'folder'
      }
    ]
    const current: CodexContextStatus = {
      available: true,
      foreground: true,
      active: true,
      provider: 'codex-app-server',
      current: {
        threadId: 'thread-two',
        threadName: 'AI 口播',
        cwd: 'D:\\自媒体\\AI口播',
        projectKey: 'cwd:ai-video',
        projectLabel: 'AI口播',
        identitySource: 'folder',
        detectedAt: start + 300_000
      },
      lastDetectedAt: start + 300_000,
      error: null
    }
    const result = aggregateActivity(
      [{ id: 1, timestamp: new Date(start).toISOString(), duration: 600, data: { app: 'Codex.exe', title: 'Codex' } }],
      [],
      [],
      true,
      { window: 'window', afk: 'afk' },
      samples,
      {},
      current,
      start + 600_000
    )

    expect(result.codexActiveSeconds).toBe(600)
    expect(result.attentionSlices.map((slice) => [slice.label, slice.seconds])).toEqual([
      ['Attention-Management', 300],
      ['AI口播', 300]
    ])
    expect(result.attentionSlices.reduce((total, slice) => total + slice.seconds, 0)).toBe(600)
    expect(result.focus).toMatchObject({ status: 'confirmed', label: 'AI口播', projectTodaySeconds: 300 })
  })

  it('marks a known but non-foreground Codex context as recent instead of continuing confirmed project time', () => {
    const now = Date.parse('2026-07-14T04:10:00.000Z')
    const result = aggregateActivity(
      [{ id: 1, timestamp: '2026-07-14T04:00:00.000Z', duration: 600, data: { app: 'chrome.exe', title: '资料' } }],
      [],
      [],
      true,
      { window: 'window', afk: 'afk' },
      [],
      {},
      {
        available: true,
        foreground: false,
        active: false,
        provider: 'codex-app-server',
        current: {
          threadId: 'thread-one',
          threadName: '时间效率助手',
          cwd: 'D:\\codex work\\Attention-Management',
          projectKey: 'cwd:attention-management',
          projectLabel: '时间效率助手',
          identitySource: 'folder',
          detectedAt: now - 60_000
        },
        lastDetectedAt: now - 60_000,
        error: null
      },
      now
    )

    expect(result.focus).toMatchObject({ status: 'recent', label: '时间效率助手', continuousSeconds: 0 })
    expect(result.attentionSlices).toEqual([
      expect.objectContaining({ kind: 'application', label: 'chrome.exe', seconds: 600 })
    ])
  })

  it('does not turn a short idle gap between matching applications into active attention', () => {
    const result = aggregateActivity(
      [
        { id: 1, timestamp: '2026-07-14T05:00:00.000Z', duration: 60, data: { app: 'chrome.exe', title: '资料 A' } },
        { id: 2, timestamp: '2026-07-14T05:01:10.000Z', duration: 60, data: { app: 'chrome.exe', title: '资料 B' } }
      ],
      [], [], true, { window: 'window', afk: 'afk' }, [], {}, undefined,
      Date.parse('2026-07-14T05:02:10.000Z')
    )
    expect(result.activeSeconds).toBe(120)
    expect(result.timeline).toHaveLength(2)
    expect(result.attentionSlices).toEqual([
      expect.objectContaining({ key: 'app:chrome.exe', seconds: 120 })
    ])
    expect(result.attentionSlices.reduce((total, slice) => total + slice.seconds, 0)).toBe(result.activeSeconds)
  })
})
