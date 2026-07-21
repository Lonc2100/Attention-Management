import type {
  CodexContextSample,
  CodexContextStatus,
  CodexThreadSummary
} from '../../shared/contracts'
import type { CurrentActivityState } from '../activitywatch'
import { deriveProjectIdentity, isCodexWindow } from '../project-attribution'
import {
  matchVisibleCodexThread,
  type VisibleCodexContext
} from '../providers/codex-visible-context'

export type CodexActivityReader = {
  getCurrentState(): Promise<CurrentActivityState>
}

export type CodexThreadReader = {
  listRecentInteractiveThreads(): Promise<CodexThreadSummary[]>
  close(): void
}

export type CodexContextSampleStore = {
  addCodexContextSample(date: string, sample: CodexContextSample): boolean
}

export type CodexVisibleContextReader = {
  readCurrentContext(): Promise<VisibleCodexContext | null>
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

/**
 * Product attribution policy for an active Codex window. The service only
 * persists a sample after a visible chat and an app-server thread match
 * uniquely agree; it never substitutes the most recent thread as a guess.
 */
export class CodexAttributionService {
  private status: CodexContextStatus = DEFAULT_STATUS
  private sampling = false

  constructor(
    private readonly activity: CodexActivityReader,
    private readonly client: CodexThreadReader,
    private readonly store: CodexContextSampleStore,
    private readonly now: () => number = Date.now,
    private readonly windowContext: CodexVisibleContextReader
  ) {}

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

      const visible = await this.windowContext.readCurrentContext()
      if (!visible) {
        this.status = {
          ...this.status,
          available: true,
          foreground: true,
          active: true,
          current: null,
          error: '当前 Codex 聊天未确认，时间暂记为待分类'
        }
        return
      }

      const threads = await this.client.listRecentInteractiveThreads()
      const current = matchVisibleCodexThread(visible, threads)
      if (!current) {
        this.status = {
          ...this.status,
          available: true,
          foreground: true,
          active: true,
          current: null,
          error: `无法唯一匹配当前 Codex 聊天“${visible.threadName}”，时间暂记为待分类`
        }
        return
      }
      const detectedAt = this.now()
      const identity = deriveProjectIdentity(current, {})
      const identitySource = identity.source === 'alias' || identity.source === 'manual' ? 'fallback' : identity.source
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
