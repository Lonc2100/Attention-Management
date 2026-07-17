import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkActivityFactsCache } from '../src/main/work-activity-facts-cache'

const created: Array<{ directory: string; file: string }> = []

function cachePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'attention-work-facts-'))
  const file = join(directory, 'facts.json')
  created.push({ directory, file })
  return file
}

afterEach(() => {
  for (const item of created.splice(0)) {
    try { unlinkSync(item.file) } catch { /* File was never written. */ }
    try { rmdirSync(item.directory) } catch { /* Keep unexpected contents for diagnosis. */ }
  }
})

describe('persisted work activity facts cache', () => {
  it('reuses historical dates across refreshes and processes but always refreshes today', async () => {
    const file = cachePath()
    const firstLoader = vi.fn(async (dates: string[]) => dates.map((date, index) => ({
      date, activeSeconds: 100 + index, observedSeconds: 120 + index, available: true
    })))
    const cache = new WorkActivityFactsCache(file)

    await cache.resolve(['2026-07-15', '2026-07-16'], '2026-07-16', firstLoader)
    await cache.resolve(['2026-07-15', '2026-07-16'], '2026-07-16', firstLoader)

    expect(firstLoader.mock.calls.map(([dates]) => dates)).toEqual([
      ['2026-07-15', '2026-07-16'],
      ['2026-07-16']
    ])

    const secondLoader = vi.fn(async (dates: string[]) => dates.map((date) => ({
      date, activeSeconds: 200, observedSeconds: 220, available: true
    })))
    const afterRestart = new WorkActivityFactsCache(file)
    const result = await afterRestart.resolve(
      ['2026-07-14', '2026-07-15', '2026-07-16'],
      '2026-07-16',
      secondLoader
    )

    expect(secondLoader).toHaveBeenCalledWith(['2026-07-14', '2026-07-16'])
    expect(result.map((item) => item.activeSeconds)).toEqual([200, 100, 200])
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })

  it('ignores a corrupt disposable cache and rebuilds it from the source', async () => {
    const file = cachePath()
    writeFileSync(file, '{not json', 'utf8')
    const loader = vi.fn(async (dates: string[]) => dates.map((date) => ({
      date, activeSeconds: 60, observedSeconds: 70, available: true
    })))

    const result = await new WorkActivityFactsCache(file).resolve(['2026-07-16'], '2026-07-16', loader)

    expect(result[0]?.activeSeconds).toBe(60)
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })
})
