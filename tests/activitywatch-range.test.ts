import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityWatchManager } from '../src/main/activitywatch'

describe('ActivityWatch range activity query', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('queries title-free active intervals and attributes them to workdays', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'window-bucket': { type: 'currentwindow', last_updated: '2026-07-16T12:00:00Z' },
        'afk-bucket': { type: 'afkstatus', last_updated: '2026-07-16T12:00:00Z' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([[
        { id: 1, timestamp: '2026-07-15T01:00:00.000Z', duration: 3600, data: {} }
      ]]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const manager = new ActivityWatchManager('unused')
    const result = await manager.getDailyActiveDurations(['2026-07-15', '2026-07-16'])

    expect(result[0]).toMatchObject({ date: '2026-07-15', activeSeconds: 3600, observedSeconds: 3600, available: true })
    expect(result[0]?.lastActiveAt).toBe('2026-07-15T02:00:00.000Z')
    expect(result[1]).toMatchObject({ date: '2026-07-16', activeSeconds: 0, observedSeconds: 0, lastActiveAt: null, available: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(url).toContain('/api/0/query/')
    const body = JSON.parse(String(options.body)) as { query: string[]; timeperiods: string[] }
    expect(body.timeperiods).toHaveLength(1)
    expect(body.query.join('\n')).toContain('filter_period_intersect')
    expect(body.query.join('\n')).toContain('period_union')
    expect(body.query.join('\n')).not.toContain('title')
  })

  it('limits every ActivityWatch query window to at most 31 days', async () => {
    const dates = Array.from({ length: 66 }, (_, index) => {
      const date = new Date(2026, 0, index + 1, 12)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'window-bucket': { type: 'currentwindow', last_updated: '2026-03-07T12:00:00Z' },
        'afk-bucket': { type: 'afkstatus', last_updated: '2026-03-07T12:00:00Z' }
      }), { status: 200 }))
      .mockImplementation(async (_url: string, options: RequestInit) => {
        expect(options.body).toBeTruthy()
        return new Response(JSON.stringify([[]]), { status: 200 })
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await new ActivityWatchManager('unused').getDailyActiveDurations(dates)

    expect(result).toHaveLength(66)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    for (const call of fetchMock.mock.calls.slice(2)) {
      const body = JSON.parse(String((call[1] as RequestInit).body)) as { timeperiods: string[] }
      expect(body.timeperiods).toHaveLength(1)
      const [start, end] = body.timeperiods[0]!.split('/').map(Date.parse)
      expect(end! - start!).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000)
    }
  })

  it('returns available zeroes when the source has no active intervals', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'window-bucket': { type: 'currentwindow', created: '2026-07-15T08:00:00Z', last_updated: '2026-07-16T12:00:00Z' },
        'afk-bucket': { type: 'afkstatus', created: '2026-07-15T08:01:00Z', last_updated: '2026-07-16T12:00:00Z' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([[]]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new ActivityWatchManager('unused').getDailyActiveDurations([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'
    ])

    expect(result).toHaveLength(4)
    expect(result.every((item) => item.available && item.activeSeconds === 0 && item.lastActiveAt === null)).toBe(true)
    const queryBody = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)) as { timeperiods: string[] }
    expect(queryBody.timeperiods).toHaveLength(1)
  })

  it('keeps the persisted workday when ActivityWatch is temporarily unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const key = await new ActivityWatchManager('unused').getCurrentWorkday({}, '2026-07-18')
    expect(key).toBe('2026-07-18')
  })
})
