import { describe, expect, it } from 'vitest'
import { parseThreadListResult } from '../src/main/codex-app-server'
describe('Codex app-server thread metadata parsing', () => {
  it('accepts root vscode threads and converts protocol seconds to Unix milliseconds', () => {
    const result = parseThreadListResult({
      data: [
        {
          id: 'thread-one',
          name: '时间效率助手',
          cwd: 'D:\\codex work\\Attention-Management',
          recencyAt: 1_784_024_720,
          source: 'vscode',
          parentThreadId: null
        }
      ]
    })
    expect(result).toEqual([
      {
        id: 'thread-one',
        name: '时间效率助手',
        cwd: 'D:\\codex work\\Attention-Management',
        recencyAt: 1_784_024_720_000,
        source: 'vscode'
      }
    ])
  })

  it('rejects malformed and sub-agent rows instead of guessing', () => {
    const result = parseThreadListResult({
      data: [
        { id: 'sub', name: 'worker', cwd: 'D:\\work', recencyAt: 1_784_024_720, source: 'vscode', parentThreadId: 'root' },
        { id: '', name: 'bad', cwd: '', recencyAt: null, source: 'unknown', parentThreadId: null }
      ]
    })
    expect(result).toEqual([])
  })

  it('throws an actionable error when the protocol shape is invalid', () => {
    expect(() => parseThreadListResult({ nope: true })).toThrow('Codex app-server 返回了无法识别的对话列表')
  })
})
