import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityWatchManager } from '../src/main/activitywatch'

describe('ActivityWatch range activity query', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('queries supplied days with the fixed server-side query', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'window-bucket': { type: 'currentwindow', last_updated: '2026-07-16T12:00:00Z' },
        'afk-bucket': { type: 'afkstatus', last_updated: '2026-07-16T12:00:00Z' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { activeSeconds: 3600, observedSeconds: 4000 },
        { activeSeconds: 0, observedSeconds: 0 }
      ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const manager = new ActivityWatchManager('unused')
    const result = await manager.getDailyActiveDurations(['2026-07-15', '2026-07-16'])

    expect(result).toEqual([
      { date: '2026-07-15', activeSeconds: 3600, observedSeconds: 4000, available: true },
      { date: '2026-07-16', activeSeconds: 0, observedSeconds: 0, available: true }
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(url).toContain('/api/0/query/')
    const body = JSON.parse(String(options.body)) as { query: string[]; timeperiods: string[] }
    expect(body.timeperiods).toHaveLength(2)
    expect(body.query.join('\n')).toContain('filter_period_intersect')
    expect(body.query.join('\n')).toContain('sum_durations')
  })

  it('limits every ActivityWatch query to at most 31 periods', async () => {
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
        const body = JSON.parse(String(options.body)) as { timeperiods: string[] }
        return new Response(JSON.stringify(body.timeperiods.map(() => ({ activeSeconds: 60, observedSeconds: 70 }))), { status: 200 })
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await new ActivityWatchManager('unused').getDailyActiveDurations(dates)

    expect(result).toHaveLength(66)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    for (const call of fetchMock.mock.calls.slice(2)) {
      const body = JSON.parse(String((call[1] as RequestInit).body)) as { timeperiods: string[] }
      expect(body.timeperiods.length).toBeLessThanOrEqual(31)
    }
  })

  it('returns known zeroes before both required buckets existed without querying those days', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'window-bucket': { type: 'currentwindow', created: '2026-07-15T08:00:00Z', last_updated: '2026-07-16T12:00:00Z' },
        'afk-bucket': { type: 'afkstatus', created: '2026-07-15T08:01:00Z', last_updated: '2026-07-16T12:00:00Z' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { activeSeconds: 600, observedSeconds: 700 },
        { activeSeconds: 800, observedSeconds: 900 }
      ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new ActivityWatchManager('unused').getDailyActiveDurations([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'
    ])

    expect(result.slice(0, 2)).toEqual([
      { date: '2026-07-13', activeSeconds: 0, observedSeconds: 0, available: true },
      { date: '2026-07-14', activeSeconds: 0, observedSeconds: 0, available: true }
    ])
    const queryBody = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)) as { timeperiods: string[] }
    expect(queryBody.timeperiods).toHaveLength(2)
  })
})
