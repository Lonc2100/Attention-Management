import { describe, expect, it } from 'vitest'
import { aggregateActivity } from '../src/main/aggregate'
import { deriveProjectIdentity } from '../src/main/project-attribution'
import type { ActivityEvent, CodexContextSample, CodexThreadSummary } from '../src/shared/contracts'

const thread = (patch: Partial<CodexThreadSummary> = {}): CodexThreadSummary => ({
  id: 'thread-one',
  name: '！默认对话',
  cwd: 'D:\\codex work',
  recencyAt: 1_784_000_000_000,
  source: 'vscode',
  ...patch
})

const sample = (detectedAt: number, current: CodexThreadSummary): CodexContextSample => {
  const identity = deriveProjectIdentity(current, {})
  return {
    detectedAt,
    threadId: current.id,
    threadName: current.name,
    cwd: current.cwd,
    recencyAt: current.recencyAt,
    source: current.source,
    projectKey: identity.key,
    projectLabel: identity.label,
    identitySource: identity.source === 'alias' || identity.source === 'manual' ? 'fallback' : identity.source
  }
}

describe('Codex project identity', () => {
  it('uses a specific project folder as the stable project identity', () => {
    const result = deriveProjectIdentity(
      thread({ cwd: 'D:\\自媒体\\Ai口播自媒体', name: '脚本优化' }),
      {}
    )
    expect(result).toEqual({
      key: 'cwd:d:\\自媒体\\ai口播自媒体',
      label: 'Ai口播自媒体',
      source: 'folder'
    })
  })

  it('uses the conversation boundary for a generic workspace root', () => {
    const result = deriveProjectIdentity(
      thread({ id: 'thread-libtv', cwd: 'D:\\codex work', name: '！！ libtv第三集' }),
      {}
    )
    expect(result).toEqual({
      key: 'thread:thread-libtv',
      label: 'libtv第三集',
      source: 'thread'
    })
  })

  it('applies an optional display alias without changing the project key', () => {
    const current = thread({ id: 'thread-time', cwd: 'C:\\work\\wo-m', name: '时间检测插件' })
    const identity = deriveProjectIdentity(current, { 'thread:thread-time': '时间效率助手' })
    expect(identity).toEqual({ key: 'thread:thread-time', label: '时间效率助手', source: 'alias' })
  })
})

describe('Codex foreground attention attribution', () => {
  it('splits at context transitions, subtracts AFK, and keeps the pre-sample gap unclassified', () => {
    const start = Date.parse('2026-07-14T01:00:00.000Z')
    const windows: ActivityEvent[] = [
      { id: 1, timestamp: new Date(start).toISOString(), duration: 600, data: { app: 'ChatGPT.exe', title: 'ChatGPT' } }
    ]
    const afk: ActivityEvent[] = [
      { id: 2, timestamp: new Date(start + 360_000).toISOString(), duration: 180, data: { status: 'afk' } }
    ]
    const first = thread({ id: 'thread-a', cwd: 'D:\\project-a', name: '项目 A' })
    const second = thread({ id: 'thread-b', cwd: 'D:\\project-b', name: '项目 B' })
    const samples = [sample(start + 120_000, first), sample(start + 300_000, second)]

    const result = aggregateActivity(windows, afk, [], true, { window: 'window', afk: 'afk' }, samples, {}, undefined, Date.now(), [], [], {}, [], undefined, 3)

    expect(result.codexActiveSeconds).toBe(420)
    expect(result.codexClassifiedSeconds).toBe(300)
    expect(result.codexUnclassifiedSeconds).toBe(120)
    expect(result.codexCoveragePercent).toBe(71)
    expect(result.projects).toEqual([
      expect.objectContaining({ key: 'cwd:d:\\project-a', label: 'project-a', seconds: 180 }),
      expect.objectContaining({ key: 'unclassified', label: '待分类', seconds: 120 }),
      expect.objectContaining({ key: 'cwd:d:\\project-b', label: 'project-b', seconds: 120 })
    ])
  })

  it('does not turn background Codex state into attention time', () => {
    const start = Date.parse('2026-07-14T02:00:00.000Z')
    const windows: ActivityEvent[] = [
      { id: 1, timestamp: new Date(start).toISOString(), duration: 300, data: { app: 'chrome.exe', title: '文档' } }
    ]
    const samples = [sample(start, thread({ cwd: 'D:\\project-a' }))]
    const result = aggregateActivity(windows, [], [], true, { window: 'window', afk: 'afk' }, samples, {})
    expect(result.codexActiveSeconds).toBe(0)
    expect(result.projects).toEqual([])
  })

  it('does not treat ChatGPT Classic as the Codex desktop project surface', () => {
    const start = Date.parse('2026-07-14T03:00:00.000Z')
    const windows: ActivityEvent[] = [
      { id: 1, timestamp: new Date(start).toISOString(), duration: 300, data: { app: 'ChatGPT.exe', title: 'ChatGPT Classic' } }
    ]
    const samples = [sample(start, thread({ cwd: 'D:\\project-a' }))]
    const result = aggregateActivity(windows, [], [], true, { window: 'window', afk: 'afk' }, samples, {})
    expect(result.codexActiveSeconds).toBe(0)
  })
})
