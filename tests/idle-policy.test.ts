import { describe, expect, it } from 'vitest'
import { classifyActivityDay } from '../src/main/classification'
import { classifyIdleIntervals, intervalSeconds } from '../src/shared/idle-policy'
import type { ActivityEvent, IdleOverride } from '../src/shared/contracts'

function afk(start: string, seconds: number): ActivityEvent {
  return { id: seconds, timestamp: start, duration: seconds, data: { status: 'afk' } }
}

describe('idle confidence policy', () => {
  it('keeps short inactivity as inferred work and excludes major absence', () => {
    const idle = classifyIdleIntervals([
      afk('2026-07-19T01:00:00.000Z', 14 * 60),
      afk('2026-07-19T02:00:00.000Z', 15 * 60)
    ], 15)
    expect(intervalSeconds(idle.soft)).toBe(14 * 60)
    expect(intervalSeconds(idle.hard)).toBe(15 * 60)
  })

  it('counts a manual hard-idle correction without modifying the source event', () => {
    const start = '2026-07-19T03:00:00.000Z'
    const end = '2026-07-19T03:20:00.000Z'
    const source = afk(start, 20 * 60)
    const override: IdleOverride = { id: 'keep-working', date: '2026-07-19', start, end, createdAt: 1 }
    const result = classifyActivityDay(
      [{ id: 2, timestamp: start, duration: 20 * 60, data: { app: 'chrome.exe', title: '长文阅读' } }],
      [source], [], {}, [], [], {}, 15, [override]
    )
    expect(result.activeSeconds).toBe(20 * 60)
    expect(result.afkSeconds).toBe(0)
    expect(result.entries).toEqual([expect.objectContaining({ idleOverrideId: 'keep-working', title: '长文阅读' })])
    expect(source).toEqual(afk(start, 20 * 60))
  })

  it('keeps a manual AFK correction visible and reversible when no foreground event overlaps it', () => {
    const start = '2026-07-19T04:00:00.000Z'
    const end = '2026-07-19T04:10:00.000Z'
    const override: IdleOverride = { id: 'watcher-gap', date: '2026-07-19', start, end, createdAt: 1 }
    const result = classifyActivityDay([], [afk(start, 10 * 60)], [], {}, [], [], {}, 5, [override])

    expect(result.activeSeconds).toBe(10 * 60)
    expect(result.afkSeconds).toBe(0)
    expect(result.entries).toEqual([expect.objectContaining({
      idleOverrideId: 'watcher-gap',
      title: '人工计入的低交互时间',
      projectLabel: '人工计入工作',
      correctable: false
    })])
  })
})
