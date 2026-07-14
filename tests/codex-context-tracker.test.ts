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
    const now = Date.parse('2026-07-14T10:30:00.000Z')
    const tracker = new CodexContextTracker(activity, client, store, () => now)

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
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now())

    await tracker.sample('2026-07-14')
    await tracker.sample('2026-07-14')

    expect(client.listRecentInteractiveThreads).not.toHaveBeenCalled()
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
    const tracker = new CodexContextTracker(activity, client, store, () => Date.now())

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
})
