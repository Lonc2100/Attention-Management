export const CRITICAL_DISK_BYTES = 2 * 1024 * 1024 * 1024
export const DISK_WARNING_BYTES = 10 * 1024 * 1024 * 1024

const RESTART_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000] as const

export type RecoveryAction = 'healthy' | 'wait' | 'restart' | 'cooldown' | 'blocked-disk' | 'external'

export interface RecoverySample {
  healthy: boolean
  freeBytes: number
  ownsServer: boolean
  now: number
}

export interface RecoveryDecision {
  action: RecoveryAction
  consecutiveFailures: number
  retryAfterMs: number
}

export class CollectorRecoveryPolicy {
  private consecutiveFailures = 0
  private restartAttempt = 0
  private nextRestartAt = 0

  evaluate(sample: RecoverySample): RecoveryDecision {
    if (sample.freeBytes < CRITICAL_DISK_BYTES) {
      return this.decision('blocked-disk', sample.now)
    }
    if (sample.healthy) {
      this.consecutiveFailures = 0
      this.restartAttempt = 0
      this.nextRestartAt = 0
      return this.decision('healthy', sample.now)
    }
    if (!sample.ownsServer) {
      this.consecutiveFailures += 1
      return this.decision('external', sample.now)
    }
    if (sample.now < this.nextRestartAt) return this.decision('cooldown', sample.now)

    this.consecutiveFailures += 1
    if (this.consecutiveFailures < 3) return this.decision('wait', sample.now)

    this.consecutiveFailures = 0
    const backoff = RESTART_BACKOFF_MS[Math.min(this.restartAttempt, RESTART_BACKOFF_MS.length - 1)]
    this.restartAttempt += 1
    this.nextRestartAt = sample.now + backoff
    return { action: 'restart', consecutiveFailures: 0, retryAfterMs: backoff }
  }

  private decision(action: RecoveryAction, now: number): RecoveryDecision {
    return {
      action,
      consecutiveFailures: this.consecutiveFailures,
      retryAfterMs: Math.max(0, this.nextRestartAt - now)
    }
  }
}
