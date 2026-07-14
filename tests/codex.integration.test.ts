import { describe, expect, it } from 'vitest'
import { runCodexReview } from '../src/main/codex'
import { disconnectedSummary } from '../src/main/aggregate'
import { emptyRecord } from '../src/main/date'

describe.skipIf(process.env.RUN_CODEX_INTEGRATION !== '1')('Codex CLI integration', () => {
  it('returns a real parsed agent message', async () => {
    const record = emptyRecord('2026-07-14')
    record.outcomes = [{ id: 'one', title: '验证真实 AI 链路' }]
    record.priorityOutcomeId = 'one'
    const activity = { ...disconnectedSummary(true, ''), connected: true, error: null }
    const answer = await runCodexReview(record, activity)
    expect(answer.length).toBeGreaterThan(20)
    expect(answer).toContain('结果')
  }, 130_000)
})
