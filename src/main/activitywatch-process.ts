import { spawn, type SpawnOptions } from 'node:child_process'
import { dirname } from 'node:path'
import type { EventEmitter } from 'node:events'
import type { Readable } from 'node:stream'

export type ActivityWatchChild = EventEmitter & {
  stderr: Readable | null
  kill(signal?: NodeJS.Signals | number): boolean
  exitCode?: number | null
  killed?: boolean
}

export type ActivityWatchSpawn = (
  executable: string,
  args: readonly string[],
  options: SpawnOptions
) => ActivityWatchChild

type LaunchOptions = {
  name: string
  executable: string
  spawnProcess?: ActivityWatchSpawn
  onError?: (error: Error) => void
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
}

export function launchActivityWatchProcess(options: LaunchOptions): ActivityWatchChild {
  const spawnProcess = options.spawnProcess ?? (spawn as ActivityWatchSpawn)
  const child = spawnProcess(options.executable, [], {
    cwd: dirname(options.executable),
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  })
  child.stderr?.on('data', (chunk: Buffer | string) => {
    console.error(`[ActivityWatch:${options.name}]`, chunk.toString())
  })
  child.on('error', (error: Error) => {
    console.error(`[ActivityWatch:${options.name}] process error`, error)
    options.onError?.(error)
  })
  child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    options.onExit?.(code, signal)
  })
  return child
}
