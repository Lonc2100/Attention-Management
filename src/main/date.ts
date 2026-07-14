import type { DailyRecord, ReminderState, Settings } from '../shared/contracts'

export function localDateKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dayBounds(date: string): { start: string; end: string } {
  const startDate = new Date(`${date}T00:00:00`)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 1)
  return { start: startDate.toISOString(), end: endDate.toISOString() }
}

function reached(time: string, now: Date): boolean {
  const [hours, minutes] = time.split(':').map(Number)
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)
}

export function reminderState(record: DailyRecord, settings: Settings, now = new Date()): ReminderState {
  return {
    morningDue: reached(settings.morningReminder, now) && !record.planCompletedAt,
    eveningDue: reached(settings.eveningReminder, now) && !record.review?.completedAt
  }
}

export function emptyRecord(date: string): DailyRecord {
  return {
    date,
    outcomes: [],
    priorityOutcomeId: null,
    planCompletedAt: null,
    review: null,
    afkNotes: [],
    aiAnalysis: null
  }
}
