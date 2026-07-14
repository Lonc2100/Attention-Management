import { describe, expect, it } from 'vitest'
import { emptyRecord, localDateKey, reminderState } from '../src/main/date'
import { defaultSettings } from '../src/main/store'

describe('date and reminder semantics', () => {
  it('uses the local calendar date instead of UTC date', () => {
    expect(localDateKey(new Date(2026, 6, 14, 0, 30))).toBe('2026-07-14')
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
