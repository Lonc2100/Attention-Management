export type OutcomeStatus = 'pending' | 'done' | 'partial' | 'dropped'

export interface Outcome {
  id: string
  title: string
}

export interface Review {
  outcomeStatuses: Record<string, OutcomeStatus>
  subjectiveScore: number
  summary: string
  tomorrowIntent: string
  completedAt: string
}

export interface AfkNote {
  id: string
  start: string
  end: string
  note: string
}

export interface DailyRecord {
  date: string
  outcomes: Outcome[]
  priorityOutcomeId: string | null
  planCompletedAt: string | null
  review: Review | null
  afkNotes: AfkNote[]
  aiAnalysis: string | null
}

export interface Settings {
  launchAtLogin: boolean
  trackingEnabled: boolean
  morningReminder: string
  eveningReminder: string
  aiProvider: 'codex-cli'
}

export interface ActivityEvent {
  id: number
  timestamp: string
  duration: number
  data: Record<string, string>
}

export interface AppUsage {
  app: string
  seconds: number
  topTitles: Array<{ title: string; seconds: number }>
}

export interface AfkPeriod {
  start: string
  end: string
  seconds: number
  note?: string
}

export interface ActivitySummary {
  connected: boolean
  tracking: boolean
  windowBucketId: string | null
  afkBucketId: string | null
  activeSeconds: number
  afkSeconds: number
  apps: AppUsage[]
  afkPeriods: AfkPeriod[]
  recentEvents: ActivityEvent[]
  error: string | null
  updatedAt: string
}

export interface ReminderState {
  morningDue: boolean
  eveningDue: boolean
}

export interface Diagnostics {
  activityWatch: { ok: boolean; detail: string }
  windowWatcher: { ok: boolean; detail: string }
  afkWatcher: { ok: boolean; detail: string }
  storage: { ok: boolean; detail: string }
  codexCli: { ok: boolean; detail: string }
  launchAtLogin: { ok: boolean; detail: string }
}

export interface BootstrapData {
  date: string
  record: DailyRecord
  settings: Settings
  activity: ActivitySummary
  reminders: ReminderState
  diagnostics: Diagnostics
}

export interface PlanInput {
  outcomes: Outcome[]
  priorityOutcomeId: string
}

export interface ReviewInput {
  outcomeStatuses: Record<string, OutcomeStatus>
  subjectiveScore: number
  summary: string
  tomorrowIntent: string
}

export interface TimeEfficiencyApi {
  bootstrap(): Promise<BootstrapData>
  refreshActivity(date?: string): Promise<ActivitySummary>
  savePlan(input: PlanInput): Promise<DailyRecord>
  saveReview(input: ReviewInput): Promise<DailyRecord>
  saveAfkNote(input: AfkNote): Promise<DailyRecord>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  setTracking(enabled: boolean): Promise<ActivitySummary>
  runAiReview(): Promise<{ text: string }>
  getDiagnostics(): Promise<Diagnostics>
  showWindow(): Promise<void>
}

export const IPC = {
  bootstrap: 'app:bootstrap',
  refreshActivity: 'activity:refresh',
  savePlan: 'record:save-plan',
  saveReview: 'record:save-review',
  saveAfkNote: 'record:save-afk-note',
  updateSettings: 'settings:update',
  setTracking: 'activity:set-tracking',
  runAiReview: 'ai:run-review',
  getDiagnostics: 'diagnostics:get',
  showWindow: 'window:show'
} as const
