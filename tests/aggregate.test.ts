import { describe, expect, it } from 'vitest'
import { aggregateActivity } from '../src/main/aggregate'
import type { ActivityEvent } from '../src/shared/contracts'

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
})
