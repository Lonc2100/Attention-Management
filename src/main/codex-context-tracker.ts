import {
  CodexWindowContextReader
} from './providers/codex-visible-context'
import {
  CodexAttributionService,
  type CodexActivityReader,
  type CodexContextSampleStore,
  type CodexThreadReader,
  type CodexVisibleContextReader
} from './services/codex-attribution-service'
import type { CodexContextStatus } from '../shared/contracts'

export class CodexContextTracker {
  private timer: NodeJS.Timeout | null = null
  private readonly attribution: CodexAttributionService

  constructor(
    activity: CodexActivityReader,
    private readonly client: CodexThreadReader,
    store: CodexContextSampleStore,
    now: () => number = Date.now,
    windowContext: CodexVisibleContextReader = new CodexWindowContextReader()
  ) {
    this.attribution = new CodexAttributionService(activity, client, store, now, windowContext)
  }

  start(dateProvider: () => string | Promise<string>, intervalMs = 5_000): void {
    if (this.timer) return
    const sampleCurrentWorkday = async () => this.sample(await dateProvider())
    void sampleCurrentWorkday()
    this.timer = setInterval(() => void sampleCurrentWorkday(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.client.close()
  }

  getStatus(): CodexContextStatus {
    return this.attribution.getStatus()
  }

  async sample(date: string): Promise<void> {
    await this.attribution.sample(date)
  }
}
