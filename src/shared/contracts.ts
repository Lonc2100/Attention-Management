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
  widgetMode: 'always-on-top' | 'desktop'
  widgetExpanded: boolean
  widgetPosition: { x: number; y: number; displayId: string } | null
}

export interface ActivityEvent {
  id: number
  timestamp: string
  duration: number
  data: Record<string, string>
}

export type ProjectIdentitySource = 'folder' | 'thread' | 'fallback' | 'alias' | 'manual'

export interface CodexThreadSummary {
  id: string
  name: string | null
  cwd: string
  recencyAt: number
  source: 'vscode'
}

export interface CodexContextSample {
  detectedAt: number
  threadId: string
  threadName: string | null
  cwd: string
  recencyAt: number
  source: 'vscode'
  projectKey: string
  projectLabel: string
  identitySource: Exclude<ProjectIdentitySource, 'alias' | 'manual'>
}

export interface ProjectUsage {
  key: string
  label: string
  seconds: number
  classified: boolean
  identitySource: ProjectIdentitySource | 'unclassified'
  threadCount: number
  latestThreadName: string | null
  cwd: string | null
}

export interface CodexCurrentContext {
  threadId: string
  threadName: string | null
  cwd: string
  projectKey: string
  projectLabel: string
  identitySource: ProjectIdentitySource
  detectedAt: number
}

export interface CodexContextStatus {
  available: boolean
  foreground: boolean
  active: boolean
  provider: 'codex-app-server'
  current: CodexCurrentContext | null
  lastDetectedAt: number | null
  error: string | null
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

export type AttentionKind = 'project' | 'codex-unclassified' | 'application' | 'afk'

export interface TimelineSlice {
  id: string
  start: string
  end: string
  seconds: number
  kind: AttentionKind
  key: string
  label: string
  app: string | null
  classified: boolean
}

export interface AttentionSlice {
  kind: Exclude<AttentionKind, 'afk'>
  key: string
  label: string
  app: string | null
  seconds: number
  classified: boolean
}

export type FocusStatus =
  | 'confirmed'
  | 'recent'
  | 'unclassified'
  | 'application'
  | 'afk'
  | 'idle'
  | 'paused'
  | 'disconnected'

export interface FocusSnapshot {
  status: FocusStatus
  label: string
  projectKey: string | null
  app: string | null
  startedAt: string | null
  continuousSeconds: number
  projectTodaySeconds: number
}

export interface ActivitySummary {
  connected: boolean
  tracking: boolean
  windowBucketId: string | null
  afkBucketId: string | null
  activeSeconds: number
  afkSeconds: number
  apps: AppUsage[]
  projects: ProjectUsage[]
  codexActiveSeconds: number
  codexClassifiedSeconds: number
  codexUnclassifiedSeconds: number
  codexCoveragePercent: number
  codexContext: CodexContextStatus
  timeline: TimelineSlice[]
  attentionSlices: AttentionSlice[]
  focus: FocusSnapshot
  afkPeriods: AfkPeriod[]
  recentEvents: ActivityEvent[]
  error: string | null
  updatedAt: string
}

export type ActivityAttribution = 'manual' | 'rule' | 'codex-context' | 'application' | 'unclassified' | 'afk'

export interface ProjectOption {
  key: string
  label: string
  source: ProjectIdentitySource
}

export interface ActivityRule {
  id: string
  projectKey: string
  app: string
  titleMatch: 'contains' | 'exact'
  titlePattern: string
  enabled: boolean
  createdAt: number
  appliesFrom: number
}

export interface ActivityOverride {
  id: string
  date: string
  start: string
  end: string
  app: string
  title: string
  projectKey: string
  createdAt: number
}

export interface ActivityDetailEntry {
  id: string
  start: string
  end: string
  seconds: number
  app: string
  title: string
  projectKey: string | null
  projectLabel: string
  attribution: ActivityAttribution
  ruleId: string | null
  overrideId: string | null
  classified: boolean
  correctable: boolean
}

export interface ActivityDetails {
  date: string
  connected: boolean
  tracking: boolean
  rangeStart: string | null
  rangeEnd: string | null
  activeSeconds: number
  afkSeconds: number
  entries: ActivityDetailEntry[]
  projectOptions: ProjectOption[]
  rules: ActivityRule[]
  partial: boolean
  warning: string | null
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
  codexContext: { ok: boolean; detail: string }
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

export interface ProjectAliasInput {
  projectKey: string
  label: string
}

export interface SaveActivityCorrectionInput {
  date: string
  entryId: string
  start: string
  end: string
  app: string
  title: string
  projectKey: string
  projectLabel?: string
  learnRule: boolean
  titleMatch?: 'contains' | 'exact'
  titlePattern?: string
}

export interface RemoveActivityCorrectionInput {
  date: string
  overrideId: string
}

export interface ActivityRuleMutationInput {
  date: string
  ruleId: string
}

export interface MoveActivityRuleInput extends ActivityRuleMutationInput {
  direction: 'up' | 'down'
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
  setProjectAlias(input: ProjectAliasInput): Promise<ActivitySummary>
  getActivityDetails(date: string): Promise<ActivityDetails>
  saveActivityCorrection(input: SaveActivityCorrectionInput): Promise<ActivityDetails>
  removeActivityCorrection(input: RemoveActivityCorrectionInput): Promise<ActivityDetails>
  setActivityRuleEnabled(input: ActivityRuleMutationInput & { enabled: boolean }): Promise<ActivityDetails>
  moveActivityRule(input: MoveActivityRuleInput): Promise<ActivityDetails>
  removeActivityRule(input: ActivityRuleMutationInput): Promise<ActivityDetails>
  showWindow(): Promise<void>
  showWidget(): Promise<void>
  hideWidget(): Promise<void>
  setWidgetExpanded(expanded: boolean): Promise<Settings>
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
  setProjectAlias: 'projects:set-alias',
  getActivityDetails: 'activity:details',
  saveActivityCorrection: 'activity:save-correction',
  removeActivityCorrection: 'activity:remove-correction',
  setActivityRuleEnabled: 'activity:rule-enabled',
  moveActivityRule: 'activity:rule-move',
  removeActivityRule: 'activity:rule-remove',
  showWindow: 'window:show',
  showWidget: 'widget:show',
  hideWidget: 'widget:hide',
  setWidgetExpanded: 'widget:set-expanded'
} as const
