import { describe, expect, it } from 'vitest'
import { CollectorRecoveryPolicy, CRITICAL_DISK_BYTES } from '../src/main/collector-recovery'

describe('collector recovery policy', () => {
  it('requires three consecutive unhealthy samples before restarting an owned server', () => {
    const policy = new CollectorRecoveryPolicy()
    const sample = { healthy: false, freeBytes: CRITICAL_DISK_BYTES + 1, ownsServer: true }

    expect(policy.evaluate({ ...sample, now: 0 }).action).toBe('wait')
    expect(policy.evaluate({ ...sample, now: 1 }).action).toBe('wait')
    const decision = policy.evaluate({ ...sample, now: 2 })
    expect(decision.action).toBe('restart')
    expect(decision.retryAfterMs).toBe(60_000)
  })

  it('never restarts an external server and blocks restart when disk space is critical', () => {
    const external = new CollectorRecoveryPolicy()
    for (let index = 0; index < 5; index += 1) {
      expect(external.evaluate({
        healthy: false,
        freeBytes: CRITICAL_DISK_BYTES + 1,
        ownsServer: false,
        now: index
      }).action).toBe('external')
    }

    const diskBlocked = new CollectorRecoveryPolicy()
    expect(diskBlocked.evaluate({
      healthy: false,
      freeBytes: CRITICAL_DISK_BYTES - 1,
      ownsServer: true,
      now: 0
    }).action).toBe('blocked-disk')
  })

  it('applies bounded restart backoff and resets it after a healthy sample', () => {
    const policy = new CollectorRecoveryPolicy()
    const unhealthy = { healthy: false, freeBytes: CRITICAL_DISK_BYTES + 1, ownsServer: true }
    policy.evaluate({ ...unhealthy, now: 0 })
    policy.evaluate({ ...unhealthy, now: 1 })
    expect(policy.evaluate({ ...unhealthy, now: 2 }).retryAfterMs).toBe(60_000)
    expect(policy.evaluate({ ...unhealthy, now: 10_000 }).action).toBe('cooldown')

    policy.evaluate({ healthy: true, freeBytes: CRITICAL_DISK_BYTES + 1, ownsServer: true, now: 10_001 })
    policy.evaluate({ ...unhealthy, now: 10_002 })
    policy.evaluate({ ...unhealthy, now: 10_003 })
    expect(policy.evaluate({ ...unhealthy, now: 10_004 }).retryAfterMs).toBe(60_000)
  })
})
