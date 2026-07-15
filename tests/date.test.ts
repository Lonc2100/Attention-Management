import { describe, expect, it } from 'vitest'
import { emptyRecord, localDateKey, recentDateKeys, reminderState } from '../src/main/date'
import { defaultSettings } from '../src/main/store'

describe('date and reminder semantics', () => {
  it('uses the local calendar date instead of UTC date', () => {
    expect(localDateKey(new Date(2026, 6, 14, 0, 30))).toBe('2026-07-14')
  })

  it('builds a bounded local-date history ending today', () => {
    expect(recentDateKeys(3, new Date(2026, 0, 2, 0, 30))).toEqual([
      '2025-12-31',
      '2026-01-01',
      '2026-01-02'
    ])
  })

  it('creates catch-up reminders only for unfinished phases after their time', () => {
    const record = emptyRecord('2026-07-14')
    expect(reminderState(record, defaultSettings, new Date(2026, 6, 14, 22, 0))).toEqual({
      morningDue: true,
      eveningDue: true
    })
    record.planCompletedAt = new Date().toISOString()
    record.review = {
      outcomeStatuses: {},
      subjectiveScore: 3,
      summary: '',
      tomorrowIntent: '',
      completedAt: new Date().toISOString()
    }
    expect(reminderState(record, defaultSettings, new Date(2026, 6, 14, 22, 0))).toEqual({
      morningDue: false,
      eveningDue: false
    })
  })
})
