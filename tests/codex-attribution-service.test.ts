import { describe, expect, it, vi } from 'vitest'
import { CodexAttributionService } from '../src/main/services/codex-attribution-service'
import type { CodexThreadSummary } from '../src/shared/contracts'

const visibleThread: CodexThreadSummary = {
  id: 'sidebar-visible',
  name: '侧边栏中的项目聊天',
  cwd: 'D:\codex work\Attention-Management',
  recencyAt: 100,
  source: 'vscode'
}

describe('Codex attribution service', () => {
  it('attributes an explicitly selected sidebar chat instead of a newer app-server thread', async () => {
    const newerThread: CodexThreadSummary = { ...visibleThread, id: 'newer', name: '另一个更近的聊天', recencyAt: 200 }
    const activity = { getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'Codex', isAfk: false }) }
    const client = { listRecentInteractiveThreads: vi.fn().mockResolvedValue([newerThread, visibleThread]), close: vi.fn() }
    const store = { addCodexContextSample: vi.fn().mockReturnValue(true) }
    const visible = { readCurrentContext: vi.fn().mockResolvedValue({ threadName: visibleThread.name, projectLabel: null, source: 'sidebar' as const }) }
    const service = new CodexAttributionService(activity, client, store, () => 123, visible)

    await service.sample('2026-07-21')

    expect(store.addCodexContextSample).toHaveBeenCalledWith('2026-07-21', expect.objectContaining({ threadId: 'sidebar-visible' }))
    expect(service.getStatus().current?.threadId).toBe('sidebar-visible')
  })

  it('keeps the interval unclassified when a selected sidebar title is ambiguous', async () => {
    const duplicate = { ...visibleThread, id: 'duplicate', cwd: 'E:\work\Attention-Management' }
    const activity = { getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'Codex', isAfk: false }) }
    const client = { listRecentInteractiveThreads: vi.fn().mockResolvedValue([visibleThread, duplicate]), close: vi.fn() }
    const store = { addCodexContextSample: vi.fn() }
    const visible = { readCurrentContext: vi.fn().mockResolvedValue({ threadName: visibleThread.name, projectLabel: null, source: 'sidebar' as const }) }
    const service = new CodexAttributionService(activity, client, store, () => 123, visible)

    await service.sample('2026-07-21')

    expect(store.addCodexContextSample).not.toHaveBeenCalled()
    expect(service.getStatus()).toMatchObject({ current: null, error: expect.stringContaining('无法唯一匹配') })
  })
})
