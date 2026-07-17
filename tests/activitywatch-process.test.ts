import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { launchActivityWatchProcess } from '../src/main/activitywatch-process'

describe('ActivityWatch child process boundary', () => {
  it('never creates an unread stdout pipe and observes errors and exits', () => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter
      kill: ReturnType<typeof vi.fn>
    }
    child.stderr = new EventEmitter()
    child.kill = vi.fn().mockReturnValue(true)
    const spawnProcess = vi.fn().mockReturnValue(child)
    const onError = vi.fn()
    const onExit = vi.fn()

    const result = launchActivityWatchProcess({
      name: 'server',
      executable: 'C:\\activitywatch\\aw-server-rust.exe',
      spawnProcess,
      onError,
      onExit
    })

    expect(spawnProcess).toHaveBeenCalledWith(
      'C:\\activitywatch\\aw-server-rust.exe',
      [],
      expect.objectContaining({ stdio: ['ignore', 'ignore', 'pipe'] })
    )
    child.emit('error', new Error('spawn failed'))
    child.emit('exit', 12, null)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'spawn failed' }))
    expect(onExit).toHaveBeenCalledWith(12, null)
    expect(result).toBe(child)
  })
})
