import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityWatchManager } from '../src/main/activitywatch'
import { CRITICAL_DISK_BYTES, DISK_WARNING_BYTES } from '../src/main/collector-recovery'

describe('ActivityWatch data-plane health', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports stale buckets as unhealthy after the startup grace period', async () => {
    let now = 0
    const manager = new ActivityWatchManager('unused', {
      now: () => now,
      freeDiskBytes: () => DISK_WARNING_BYTES + 1
    })
    now = 180_000
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      window: { type: 'currentwindow', last_updated: new Date(0).toISOString() },
      afk: { type: 'afkstatus', last_updated: new Date(170_000).toISOString() }
    }), { status: 200 })))

    const health = await manager.dataHealth()

    expect(health.ok).toBe(false)
    expect(health.detail).toContain('currentwindow')
    expect(health.detail).toContain('120 秒')
  })

  it('allows the normal AFK transition gap but rejects an AFK bucket older than five minutes', async () => {
    let now = 0
    const manager = new ActivityWatchManager('unused', { now: () => now })
    now = 400_000
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        window: { type: 'currentwindow', metadata: { end: new Date(390_000).toISOString() } },
        afk: { type: 'afkstatus', metadata: { end: new Date(220_000).toISOString() } }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        window: { type: 'currentwindow', metadata: { end: new Date(390_000).toISOString() } },
        afk: { type: 'afkstatus', metadata: { end: new Date(90_000).toISOString() } }
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await manager.dataHealth()).toEqual({ ok: true, detail: '数据桶持续更新' })
    const stale = await manager.dataHealth()
    expect(stale.ok).toBe(false)
    expect(stale.detail).toContain('afkstatus')
    expect(stale.detail).toContain('300 秒')
  })

  it('accepts fresh window and AFK buckets', async () => {
    let now = 0
    const manager = new ActivityWatchManager('unused', { now: () => now })
    now = 180_000
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      window: { type: 'currentwindow', last_updated: null, metadata: { end: new Date(170_000).toISOString() } },
      afk: { type: 'afkstatus', last_updated: null, metadata: { end: new Date(170_000).toISOString() } }
    }), { status: 200 })))

    expect(await manager.dataHealth()).toEqual({ ok: true, detail: '数据桶持续更新' })
  })

  it('distinguishes disk warning from the critical recovery cutoff', () => {
    const warning = new ActivityWatchManager('unused', { freeDiskBytes: () => DISK_WARNING_BYTES - 1 }).diskHealth()
    const critical = new ActivityWatchManager('unused', { freeDiskBytes: () => CRITICAL_DISK_BYTES - 1 }).diskHealth()

    expect(warning).toMatchObject({ ok: false, critical: false })
    expect(critical).toMatchObject({ ok: false, critical: true })
  })
})
