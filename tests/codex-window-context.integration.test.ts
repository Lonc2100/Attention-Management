import { expect, it } from 'vitest'
import { CodexAppServerClient } from '../src/main/codex-app-server'
import { CodexWindowContextReader, matchVisibleCodexThread } from '../src/main/codex-window-context'

const runIntegration = process.env.RUN_CODEX_WINDOW_INTEGRATION === '1' ? it : it.skip

runIntegration('reads the real current Codex desktop chat and maps it to one app-server thread', async () => {
  const reader = new CodexWindowContextReader({ timeoutMs: 4_000 })
  const client = new CodexAppServerClient({ requestTimeoutMs: 15_000 })
  try {
    const visible = await reader.readCurrentContext()
    expect(visible).not.toBeNull()
    const threads = await client.listRecentInteractiveThreads()
    expect(
      matchVisibleCodexThread(visible!, threads),
      JSON.stringify({ visible, candidates: threads.filter((thread) => thread.name === visible?.threadName) })
    ).not.toBeNull()
  } finally {
    client.close()
  }
}, 30_000)
