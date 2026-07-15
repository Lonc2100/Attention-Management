import { describe, expect, it, vi } from 'vitest'
import {
  CodexWindowContextReader,
  matchVisibleCodexThread,
  parseCodexWindowContextOutput
} from '../src/main/codex-window-context'
import type { CodexThreadSummary } from '../src/shared/contracts'

const thread = (overrides: Partial<CodexThreadSummary>): CodexThreadSummary => ({
  id: 'thread-a',
  name: '项目周报',
  cwd: 'D:\\codex work\\Attention-Management',
  recencyAt: 1_784_024_720_000,
  source: 'vscode',
  ...overrides
})

describe('Codex Windows current chat reader', () => {
  it('parses only the small JSON context emitted by UI Automation', () => {
    expect(parseCodexWindowContextOutput('{"threadName":"项目周报","projectLabel":"Attention-Management"}\r\n')).toEqual({
      threadName: '项目周报',
      projectLabel: 'Attention-Management'
    })
    expect(parseCodexWindowContextOutput('')).toBeNull()
    expect(() => parseCodexWindowContextOutput('not json')).toThrow('无法识别')
  })

  it('uses an injected command runner and returns null when Codex has no readable current chat', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce('{"threadName":"项目周报","projectLabel":"Attention-Management"}')
      .mockResolvedValueOnce('')
    const reader = new CodexWindowContextReader({ run })

    await expect(reader.readCurrentContext()).resolves.toEqual({
      threadName: '项目周报',
      projectLabel: 'Attention-Management'
    })
    await expect(reader.readCurrentContext()).resolves.toBeNull()
    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe('visible Codex chat matching', () => {
  it('selects the visible title instead of the most recently interacted thread', () => {
    const recent = thread({ id: 'recent', name: '旧项目', recencyAt: 20 })
    const visible = thread({ id: 'visible', name: '新项目', recencyAt: 10 })

    expect(matchVisibleCodexThread({ threadName: '新项目', projectLabel: 'Attention-Management' }, [recent, visible])).toEqual(visible)
  })

  it('disambiguates duplicate titles with the visible project label and cwd basename', () => {
    const alpha = thread({ id: 'alpha', cwd: 'D:\\work\\Alpha' })
    const beta = thread({ id: 'beta', cwd: 'D:\\work\\Beta' })

    expect(matchVisibleCodexThread({ threadName: '项目周报', projectLabel: 'Beta' }, [alpha, beta])).toEqual(beta)
  })

  it('refuses to guess when the visible chat has zero or multiple candidates', () => {
    const one = thread({ id: 'one', cwd: 'D:\\work\\Same' })
    const two = thread({ id: 'two', cwd: 'E:\\work\\Same' })

    expect(matchVisibleCodexThread({ threadName: '不存在', projectLabel: null }, [one])).toBeNull()
    expect(matchVisibleCodexThread({ threadName: '项目周报', projectLabel: 'Same' }, [one, two])).toBeNull()
    expect(matchVisibleCodexThread({ threadName: '项目周报', projectLabel: 'Other' }, [one])).toBeNull()
  })
})
