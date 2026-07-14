import type {
  CodexContextSample,
  CodexContextStatus,
  CodexThreadSummary
} from '../shared/contracts'
import type { CurrentActivityState } from './activitywatch'
import { deriveProjectIdentity, isCodexWindow } from './project-attribution'

type ActivityReader = {
  getCurrentState(): Promise<CurrentActivityState>
}

type ThreadReader = {
  listRecentInteractiveThreads(): Promise<CodexThreadSummary[]>
  close(): void
}

type SampleStore = {
  addCodexContextSample(date: string, sample: CodexContextSample): boolean
}

const DEFAULT_STATUS: CodexContextStatus = {
  available: false,
  foreground: false,
  active: false,
  provider: 'codex-app-server',
  current: null,
  lastDetectedAt: null,
  error: null
}

export class CodexContextTracker {
  private status: CodexContextStatus = DEFAULT_STATUS
  private timer: NodeJS.Timeout | null = null
  private sampling = false

  constructor(
    private readonly activity: ActivityReader,
    private readonly client: ThreadReader,
    private readonly store: SampleStore,
    private readonly now: () => number = Date.now
  ) {}

  start(dateProvider: () => string, intervalMs = 5_000): void {
    if (this.timer) return
    void this.sample(dateProvider())
    this.timer = setInterval(() => void this.sample(dateProvider()), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.client.close()
  }

  getStatus(): CodexContextStatus {
    return structuredClone(this.status)
  }

  async sample(date: string): Promise<void> {
    if (this.sampling) return
    this.sampling = true
    let isForeground = false
    let isActive = false
    try {
      const foreground = await this.activity.getCurrentState()
      isForeground = isCodexWindow(foreground.app, foreground.title)
      isActive = isForeground && !foreground.isAfk && foreground.fresh !== false
      if (!isActive) {
        this.status = {
          ...this.status,
          foreground: isForeground,
          active: false
        }
        return
      }

      const threads = await this.client.listRecentInteractiveThreads()
      const current = threads[0]
      if (!current) throw new Error('Codex 没有可识别的桌面对话，请先打开一个项目对话')
      const detectedAt = this.now()
      const identity = deriveProjectIdentity(current, {})
      const identitySource = identity.source === 'alias' ? 'fallback' : identity.source
      const sample: CodexContextSample = {
        detectedAt,
        threadId: current.id,
        threadName: current.name,
        cwd: current.cwd,
        recencyAt: current.recencyAt,
        source: current.source,
        projectKey: identity.key,
        projectLabel: identity.label,
        identitySource
      }
      this.store.addCodexContextSample(date, sample)
      this.status = {
        available: true,
        foreground: true,
        active: true,
        provider: 'codex-app-server',
        current: {
          threadId: sample.threadId,
          threadName: sample.threadName,
          cwd: sample.cwd,
          projectKey: sample.projectKey,
          projectLabel: sample.projectLabel,
          identitySource: sample.identitySource,
          detectedAt
        },
        lastDetectedAt: detectedAt,
        error: null
      }
    } catch (error) {
      this.status = {
        ...this.status,
        available: false,
        foreground: isForeground,
        active: isActive,
        current: null,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      this.sampling = false
    }
  }
}
