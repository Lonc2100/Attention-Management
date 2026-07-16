import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityWatchManager } from '../src/main/activitywatch'

describe('ActivityWatch range activity query', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('queries all supplied days in one fixed server-side query request', async () => {
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
})

