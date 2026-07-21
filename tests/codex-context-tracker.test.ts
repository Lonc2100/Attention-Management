import { describe, expect, it, vi } from 'vitest'
import { CodexContextTracker } from '../src/main/codex-context-tracker'
import type { CodexThreadSummary } from '../src/shared/contracts'
const currentThread: CodexThreadSummary = {
  id: 'thread-time',
  name: '！时间检测插件',
  cwd: 'C:\\work\\wo-m',
  recencyAt: 1_784_024_720_000,
  source: 'vscode'
}

describe('Codex foreground context tracker', () => {
  it('persists an automatic context sample only for active Codex foreground attention', async () => {
    const activity = {
      getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'ChatGPT', isAfk: false })
    }
    const client = {
      listRecentInteractiveThreads: vi.fn().mockResolvedValue([currentThread]),
      close: vi.fn()
    }
    const store = { addCodexContextSample: vi.fn().mockReturnValue(true) }
    const windowContext = { readCurrentContext: vi.fn().mockResolvedValue({ threadName: currentThread.name, projectLabel: 'wo-m', source: 'top-bar' }) }
    const now = Date.parse('2026-07-14T10:30:00.000Z')
    const tracker = new CodexContextTracker(activity, client, store, () => now, windowContext)

    await tracker.sample('2026-07-14')

    expect(client.listRecentInteractiveThreads).toHaveBeenCalledTimes(1)
    expect(store.addCodexContextSample).toHaveBeenCalledWith('2026-07-14', expect.objectContaining({
      detectedAt: now,
      threadId: 'thread-time',
      projectKey: 'thread:thread-time',
      projectLabel: '时间检测插件',
      identitySource: 'thread'
    }))
    expect(tracker.getStatus()).toMatchObject({
      available: true,
      foreground: true,
      active: true,
      current: { threadId: 'thread-time', projectLabel: '时间检测插件' },
      error: null
    })
  })

  it('does not query Codex while another app is foreground or the user is AFK', async () => {
    const activity = {
      getCurrentState: vi.fn()
        .mockResolvedValueOnce({ app: 'chrome.exe', title: '文档', isAfk: false })
        .mockResolvedValueOnce({ app: 'ChatGPT.exe', title: 'ChatGPT', isAfk: true })
    }
    const client = {
      listRecentInteractiveThreads: vi.fn().mockResolvedValue([currentThread]),
      close: vi.fn()
    }
    const store = { addCodexContextSample: vi.fn() }
    const windowContext = { readCurrentContext: vi.fn() }
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now(), windowContext)

    await tracker.sample('2026-07-14')
    await tracker.sample('2026-07-14')

    expect(client.listRecentInteractiveThreads).not.toHaveBeenCalled()
    expect(windowContext.readCurrentContext).not.toHaveBeenCalled()
    expect(store.addCodexContextSample).not.toHaveBeenCalled()
    expect(tracker.getStatus()).toMatchObject({ foreground: true, active: false })
  })

  it('surfaces app-server failure and leaves the interval unclassified', async () => {
    const activity = {
      getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'ChatGPT', isAfk: false })
    }
    const client = {
      listRecentInteractiveThreads: vi.fn().mockRejectedValue(new Error('协议不可用')),
      close: vi.fn()
    }
    const store = { addCodexContextSample: vi.fn() }
    const windowContext = { readCurrentContext: vi.fn().mockResolvedValue({ threadName: currentThread.name, projectLabel: 'wo-m', source: 'top-bar' }) }
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now(), windowContext)

    await tracker.sample('2026-07-14')

    expect(store.addCodexContextSample).not.toHaveBeenCalled()
    expect(tracker.getStatus()).toMatchObject({
      available: false,
      foreground: true,
      active: true,
      current: null,
      error: '协议不可用'
    })
  })

  it('switches to the currently visible chat even when another thread has newer recency', async () => {
    const olderVisible = { ...currentThread, id: 'visible-b', name: 'B 项目', recencyAt: currentThread.recencyAt - 60_000 }
    const activity = {
      getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'ChatGPT', isAfk: false })
    }
    const client = {
      listRecentInteractiveThreads: vi.fn().mockResolvedValue([currentThread, olderVisible]),
      close: vi.fn()
    }
    const store = { addCodexContextSample: vi.fn().mockReturnValue(true) }
    const windowContext = { readCurrentContext: vi.fn().mockResolvedValue({ threadName: 'B 项目', projectLabel: 'wo-m', source: 'sidebar' }) }
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now(), windowContext)

    await tracker.sample('2026-07-15')

    expect(store.addCodexContextSample).toHaveBeenCalledWith('2026-07-15', expect.objectContaining({ threadId: 'visible-b' }))
    expect(tracker.getStatus().current?.threadId).toBe('visible-b')
  })

  it('clears the previous project when the current visible chat becomes unreadable', async () => {
    const activity = {
      getCurrentState: vi.fn().mockResolvedValue({ app: 'ChatGPT.exe', title: 'ChatGPT', isAfk: false })
    }
    const client = {
      listRecentInteractiveThreads: vi.fn().mockResolvedValue([currentThread]),
      close: vi.fn()
    }
    const store = { addCodexContextSample: vi.fn().mockReturnValue(true) }
    const windowContext = {
      readCurrentContext: vi.fn()
        .mockResolvedValueOnce({ threadName: currentThread.name, projectLabel: 'wo-m', source: 'top-bar' })
        .mockResolvedValueOnce(null)
    }
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now(), windowContext)

    await tracker.sample('2026-07-15')
    await tracker.sample('2026-07-15')

    expect(store.addCodexContextSample).toHaveBeenCalledTimes(1)
    expect(tracker.getStatus()).toMatchObject({
      available: true,
      foreground: true,
      active: true,
      current: null,
      error: '当前 Codex 聊天未确认，时间暂记为待分类'
    })
  })
})
