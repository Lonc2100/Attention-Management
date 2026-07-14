import { afterAll, describe, expect, it } from 'vitest'
import { CodexAppServerClient } from '../src/main/codex-app-server'

const client = new CodexAppServerClient()

describe.skipIf(process.env.RUN_CODEX_CONTEXT_INTEGRATION !== '1')('Codex app-server context integration', () => {
  afterAll(() => client.close())

  it('returns real interactive desktop threads sorted by Codex recency', async () => {
    const threads = await client.listRecentInteractiveThreads()
    expect(threads.length).toBeGreaterThan(0)
    expect(threads[0].source).toBe('vscode')
    expect(threads[0].cwd.length).toBeGreaterThan(2)
    expect(threads[0].recencyAt).toBeGreaterThan(1_000_000_000_000)
  }, 20_000)
})
