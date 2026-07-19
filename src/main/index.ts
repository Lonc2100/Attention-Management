import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import type {
  AfkNote,
  MoveActivityRuleInput,
  PlanInput,
  RemoveActivityCorrectionInput,
  ReviewInput,
  SaveActivityCorrectionInput,
  Settings,
  WorkActivityDashboard,
  WorkActivityMode
} from '../shared/contracts'
import { IPC } from '../shared/contracts'
import { buildPersonalInsights } from '../shared/outcome-insights'
import { aggregateWorkActivity, buildWorkPeriodMetrics } from '../shared/work-activity'
import { ActivityWatchManager } from './activitywatch'
import { CodexAppServerClient } from './codex-app-server'
import { CodexContextTracker } from './codex-context-tracker'
import { codexDiagnostics, runCodexReview } from './codex'
import { localDateKey, recentDateKeys, reminderState } from './date'
import { AppStore } from './store'
import { applyWidgetMode, widgetBounds, WIDGET_SIZE } from './floating-window'
import { buildAggregatedCsv, createBackupEnvelope, parseBackupEnvelope } from './backup-service'
import { WorkActivityFactsCache } from './work-activity-facts-cache'

let window: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let store: AppStore
let activityWatch: ActivityWatchManager
let workActivityFactsCache: WorkActivityFactsCache
let codexContextTracker: CodexContextTracker
let widgetPositionTimer: NodeJS.Timeout | null = null
const notified = new Set<string>()
const e2eMode = process.env.TIME_EFFICIENCY_E2E === '1'
const startHidden = process.argv.includes('--hidden')
const workActivityCache = new Map<WorkActivityMode, { expiresAt: number; value: WorkActivityDashboard }>()

function runtimeRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'activitywatch') : join(app.getAppPath(), 'runtime', 'activitywatch')
}

function shiftDateKey(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localDateKey(value)
}

function supportingDateKeys(workdayKey: string): string[] {
  return [workdayKey, shiftDateKey(workdayKey, 1), shiftDateKey(workdayKey, 2)]
}

async function currentWorkdayKey(): Promise<string> {
  const key = await activityWatch.getCurrentWorkday(store.getWorkdayBoundaryOverrides(), store.getLastResolvedWorkdayKey())
  store.setLastResolvedWorkdayKey(key)
  return key
}

function combinedContextSamples(workdayKey: string) {
  return supportingDateKeys(workdayKey).flatMap((date) => store.getCodexContextSamples(date))
}

function combinedActivityOverrides(workdayKey: string) {
  return supportingDateKeys(workdayKey).flatMap((date) => store.getActivityOverrides(date))
}

function combinedAfkNotes(workdayKey: string) {
  return supportingDateKeys(workdayKey).flatMap((date) => store.getRecordSnapshot(date).afkNotes)
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0f14',
    title: '时间效率助手',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (!startHidden) window.once('ready-to-show', () => window?.show())
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      window?.hide()
    }
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    if (e2eMode) url.searchParams.set('e2e', '1')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), e2eMode ? { query: { e2e: '1' } } : undefined)
  }
}

function displayAreas() {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display) => ({
    id: String(display.id),
    primary: display.id === primaryId,
    workArea: display.workArea
  }))
}

function widgetUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'widget')
    if (e2eMode) url.searchParams.set('e2e', '1')
    return url.toString()
  }
  return ''
}

function rememberWidgetPosition(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetPositionTimer) clearTimeout(widgetPositionTimer)
  widgetPositionTimer = setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return
    const bounds = widgetWindow.getBounds()
    const display = screen.getDisplayMatching(bounds)
    store.updateSettings({ widgetPosition: { x: bounds.x, y: bounds.y, displayId: String(display.id) } })
  }, 250)
}

function createWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) return
  const settings = store.getSettings()
  const bounds = widgetBounds(displayAreas(), settings)
  widgetWindow = new BrowserWindow({
    ...bounds,
    minWidth: WIDGET_SIZE.collapsed.width,
    minHeight: WIDGET_SIZE.collapsed.height,
    maxWidth: WIDGET_SIZE.expanded.width,
    maxHeight: WIDGET_SIZE.expanded.height,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#0d151a',
    title: '时间效率助手 · 悬浮专注窗',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  applyWidgetMode(widgetWindow, settings.widgetMode)
  widgetWindow.once('ready-to-show', () => widgetWindow?.showInactive())
  widgetWindow.on('move', rememberWidgetPosition)
  widgetWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      widgetWindow?.hide()
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) void widgetWindow.loadURL(widgetUrl())
  else void widgetWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'widget', ...(e2eMode ? { e2e: '1' } : {}) } })
}

function showWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow()
  widgetWindow?.showInactive()
}

function setWidgetExpanded(expanded: boolean): Settings {
  const currentBounds = widgetWindow?.getBounds()
  const currentDisplay = currentBounds ? screen.getDisplayMatching(currentBounds) : null
  const settings = store.updateSettings({
    widgetExpanded: expanded,
    ...(currentBounds && currentDisplay ? { widgetPosition: { x: currentBounds.x, y: currentBounds.y, displayId: String(currentDisplay.id) } } : {})
  })
  if (widgetWindow) widgetWindow.setBounds(widgetBounds(displayAreas(), settings), true)
  return settings
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#70e1b2"/><path d="M9 9h14v4h-5v10h-4V13H9z" fill="#08120e"/></svg>').toString('base64')
  )
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('时间效率助手')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开时间效率助手', click: () => showWindow() },
      { label: '显示悬浮专注窗', click: () => showWidget() },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showWindow)
}

function showWindow(): void {
  if (!window) createWindow()
  window?.show()
  window?.focus()
}

function applyLaunchAtLogin(enabled: boolean): void {
  if (e2eMode) return
  const stableExecutable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
  app.setLoginItemSettings({ openAtLogin: enabled, path: stableExecutable, args: ['--hidden'] })
}

async function diagnostics() {
  const settings = store.getSettings()
  const [server, windowWatcher, afkWatcher, diskSpace, codex] = await Promise.all([
    activityWatch.health(),
    activityWatch.bucketHealth('currentwindow'),
    activityWatch.bucketHealth('afkstatus'),
    Promise.resolve(activityWatch.diskHealth()),
    codexDiagnostics()
  ])
  const login = app.getLoginItemSettings()
  const contextStatus = codexContextTracker?.getStatus()
  const contextDetail = contextStatus?.current
    ? `${contextStatus.current.projectLabel} / ${contextStatus.current.threadName ?? '未命名对话'}`
    : contextStatus?.error ?? '等待 Codex 首次处于前台且用户非 AFK 时自动识别'
  return {
    activityWatch: server,
    windowWatcher,
    afkWatcher,
    diskSpace,
    collectorRecovery: activityWatch.recoveryHealth(),
    storage: { ok: true, detail: store.path },
    codexCli: codex,
    codexContext: {
      ok: contextStatus?.available ?? false,
      detail: contextDetail
    },
    launchAtLogin: {
      ok: login.openAtLogin === settings.launchAtLogin,
      detail: login.openAtLogin ? '已启用 Windows 登录自启' : '未启用 Windows 登录自启'
    }
  }
}

async function activitySummary(date: string) {
  return activityWatch.getSummary(
    date,
    combinedAfkNotes(date),
    combinedContextSamples(date),
    store.getProjectAliases(),
    codexContextTracker?.getStatus(),
    store.getClassificationRules(),
    combinedActivityOverrides(date),
    store.getManualProjects(),
    store.getPrivacyRules(),
    store.getWorkdayBoundaryOverrides()
  )
}

async function historicalActivitySummary(date: string) {
  return activityWatch.getSummary(
    date,
    combinedAfkNotes(date),
    combinedContextSamples(date),
    store.getProjectAliases(),
    undefined,
    store.getClassificationRules(),
    combinedActivityOverrides(date),
    store.getManualProjects(),
    store.getPrivacyRules(),
    store.getWorkdayBoundaryOverrides()
  )
}

async function personalInsights(days: 7 | 14 | 30) {
  const inputs = []
  for (const date of recentDateKeys(days)) {
    inputs.push({
      record: store.getRecordSnapshot(date),
      activity: await historicalActivitySummary(date)
    })
  }
  return buildPersonalInsights(inputs, days)
}

function periodDateKeys(mode: WorkActivityMode, now = new Date()): string[] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  const start = new Date(end)
  if (mode === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  if (mode === 'month') start.setDate(1)
  const keys: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) keys.push(localDateKey(cursor))
  return keys
}

function invalidateWorkActivityCache(): void {
  workActivityCache.clear()
}

function idlePolicyKey(): string {
  const settings = store.getSettings()
  return JSON.stringify({
    threshold: settings.idleThresholdMinutes,
    overrides: store.getIdleOverrides().map((item) => [item.id, item.start, item.end]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  })
}

function applyIdlePolicy(): void {
  const settings = store.getSettings()
  activityWatch.setIdlePolicy(settings.idleThresholdMinutes, store.getIdleOverrides())
  invalidateWorkActivityCache()
}

async function workActivityDashboard(mode: WorkActivityMode): Promise<WorkActivityDashboard> {
  const cached = workActivityCache.get(mode)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const today = await currentWorkdayKey()
  const anchor = new Date(`${today}T12:00:00`)
  const chartDates = recentDateKeys(366, anchor)
  let available = true
  let error: string | null = null
  let facts
  try {
    facts = await workActivityFactsCache.resolve(
      chartDates,
      today,
      idlePolicyKey(),
      (dates) => activityWatch.getDailyActiveDurations(dates, store.getWorkdayBoundaryOverrides())
    )
  } catch (cause) {
    available = false
    error = cause instanceof Error ? cause.message : String(cause)
    facts = chartDates.map((date) => ({ date, activeSeconds: 0, observedSeconds: 0, available: false }))
  }

  const metricDates = periodDateKeys(mode, anchor)
  const inputs = available ? await Promise.all(metricDates.map(async (date) => ({
    record: store.getRecordSnapshot(date),
    activity: await historicalActivitySummary(date)
  }))) : []
  const value: WorkActivityDashboard = {
    mode,
    rangeStart: metricDates[0] ?? today,
    rangeEnd: metricDates.at(-1) ?? today,
    cells: aggregateWorkActivity(facts, mode),
    metrics: buildWorkPeriodMetrics(inputs, mode),
    available,
    error,
    generatedAt: new Date().toISOString()
  }
  workActivityCache.set(mode, { expiresAt: Date.now() + 5 * 60_000, value })
  return value
}

async function activityDetails(date: string) {
  const details = await activityWatch.getDetails(
    date,
    combinedContextSamples(date),
    store.getProjectAliases(),
    store.getClassificationRules(),
    combinedActivityOverrides(date),
    store.getManualProjects(),
    store.getPrivacyRules(),
    store.getWorkdayBoundaryOverrides()
  )
  const projects = new Map(store.getKnownProjectOptions().map((project) => [project.key, project]))
  for (const project of details.projectOptions) projects.set(project.key, project)
  return { ...details, projectOptions: [...projects.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')) }
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function meaningfulRulePattern(value: string): boolean {
  return value.trim().replace(/\s+/g, ' ').length >= 4
}

async function bootstrap() {
  const date = await currentWorkdayKey()
  const record = store.getRecord(date)
  const settings = store.getSettings()
  return {
    date,
    record,
    settings,
    activity: await activitySummary(date),
    reminders: reminderState(record, settings),
    diagnostics: await diagnostics(),
    projectOptions: store.getKnownProjectOptions()
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.bootstrap, bootstrap)
  ipcMain.handle(IPC.refreshActivity, async (_event, date?: string) => {
    const key = date || await currentWorkdayKey()
    return activitySummary(key)
  })
  ipcMain.handle(IPC.savePlan, async (_event, input: PlanInput) => {
    const knownProjectKeys = new Set(store.getKnownProjectOptions().map((project) => project.key))
    const outcomes = input.outcomes.map((item) => ({
      ...item,
      title: item.title.trim(),
      projectKeys: [...new Set((Array.isArray(item.projectKeys) ? item.projectKeys : [])
        .map((key) => key.trim())
        .filter((key) => knownProjectKeys.has(key)))]
    })).filter((item) => item.title).slice(0, 3)
    if (!outcomes.length) throw new Error('至少填写一个重要成果')
    if (!outcomes.some((item) => item.id === input.priorityOutcomeId)) throw new Error('请选择一个绝对优先项')
    const saved = store.updateRecord(await currentWorkdayKey(), (record) => ({
      ...record,
      outcomes,
      priorityOutcomeId: input.priorityOutcomeId,
      planCompletedAt: new Date().toISOString()
    }))
    invalidateWorkActivityCache()
    return saved
  })
  ipcMain.handle(IPC.saveReview, async (_event, input: ReviewInput) => {
    if (input.subjectiveScore < 1 || input.subjectiveScore > 5) throw new Error('主观效率评分必须在 1–5 之间')
    const saved = store.updateRecord(await currentWorkdayKey(), (record) => ({
      ...record,
      review: { ...input, summary: input.summary.trim(), tomorrowIntent: input.tomorrowIntent.trim(), completedAt: new Date().toISOString() }
    }))
    invalidateWorkActivityCache()
    return saved
  })
  ipcMain.handle(IPC.saveAfkNote, async (_event, input: AfkNote) =>
    store.updateRecord(await currentWorkdayKey(), (record) => ({
      ...record,
      afkNotes: [...record.afkNotes.filter((note) => note.id !== input.id), { ...input, note: input.note.trim() }]
    }))
  )
  ipcMain.handle(IPC.updateSettings, (_event, patch: Partial<Settings>) => {
    const settings = store.updateSettings(patch)
    if (patch.idleThresholdMinutes !== undefined) applyIdlePolicy()
    applyLaunchAtLogin(settings.launchAtLogin)
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      applyWidgetMode(widgetWindow, settings.widgetMode)
      if (typeof patch.widgetExpanded === 'boolean') setWidgetExpanded(patch.widgetExpanded)
    }
    return settings
  })
  ipcMain.handle(IPC.setTracking, async (_event, enabled: boolean) => {
    store.updateSettings({ trackingEnabled: enabled })
    await activityWatch.setTracking(enabled)
    const date = await currentWorkdayKey()
    return activitySummary(date)
  })
  ipcMain.handle(IPC.runAiReview, async () => {
    const date = await currentWorkdayKey()
    const record = store.getRecord(date)
    const activity = await activitySummary(date)
    if (!activity.connected) throw new Error(`ActivityWatch 未连接：${activity.error}`)
    const text = await runCodexReview(record, activity)
    store.updateRecord(date, (current) => ({ ...current, aiAnalysis: text }))
    return { text }
  })
  ipcMain.handle(IPC.getDiagnostics, diagnostics)
  ipcMain.handle(IPC.setProjectAlias, async (_event, input: { projectKey?: unknown; label?: unknown }) => {
    if (typeof input?.projectKey !== 'string' || typeof input?.label !== 'string') {
      throw new Error('项目名称参数无效')
    }
    store.setProjectAlias(input.projectKey, input.label)
    return activitySummary(await currentWorkdayKey())
  })
  ipcMain.handle(IPC.getActivityDetails, (_event, date: unknown) => {
    if (!validDate(date)) throw new Error('活动日期无效')
    return activityDetails(date)
  })
  ipcMain.handle(IPC.setWorkdayBoundary, async (_event, input: { date?: unknown; startsAt?: unknown }) => {
    if (!validDate(input?.date) || typeof input?.startsAt !== 'string') throw new Error('工作日边界参数无效')
    const timestamp = Date.parse(input.startsAt)
    if (!Number.isFinite(timestamp) || localDateKey(new Date(timestamp)) !== input.date) throw new Error('工作日边界必须位于所选日期内')
    store.setWorkdayBoundary(input.date, new Date(timestamp).toISOString())
    activityWatch.invalidateWorkdayCache()
    invalidateWorkActivityCache()
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.removeWorkdayBoundary, async (_event, input: { date?: unknown }) => {
    if (!validDate(input?.date)) throw new Error('工作日边界日期无效')
    store.removeWorkdayBoundary(input.date)
    activityWatch.invalidateWorkdayCache()
    invalidateWorkActivityCache()
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.saveActivityCorrection, async (_event, input: SaveActivityCorrectionInput) => {
    if (!validDate(input?.date) || typeof input?.entryId !== 'string' || typeof input?.start !== 'string'
      || typeof input?.end !== 'string' || typeof input?.app !== 'string' || typeof input?.title !== 'string'
      || typeof input?.projectKey !== 'string' || typeof input?.learnRule !== 'boolean') {
      throw new Error('活动纠错参数无效')
    }
    const start = Date.parse(input.start)
    const end = Date.parse(input.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 24 * 60 * 60 * 1000) {
      throw new Error('活动纠错时间范围无效')
    }
    const current = await activityDetails(input.date)
    const selected = current.entries.find((entry) => entry.id === input.entryId
      && entry.start === input.start && entry.end === input.end && entry.app === input.app && entry.title === input.title)
    if (!selected || !selected.correctable || selected.attribution === 'afk') throw new Error('这条活动已经变化，请刷新后重新选择')

    let projectKey = input.projectKey.trim()
    if (projectKey === '__new__') {
      const label = input.projectLabel?.trim().slice(0, 60) ?? ''
      if (!label) throw new Error('请输入新项目名称')
      projectKey = `manual:${randomUUID()}`
      store.setManualProject(projectKey, label)
    }
    const knownKeys = new Set([...current.projectOptions.map((item) => item.key), ...Object.keys(store.getManualProjects())])
    if (!knownKeys.has(projectKey)) throw new Error('请选择有效项目')
    if (selected.overrideId) store.removeActivityOverride(input.date, selected.overrideId)
    store.addActivityOverride({
      id: randomUUID(),
      date: input.date,
      start: input.start,
      end: input.end,
      app: input.app.slice(0, 200),
      title: input.title.slice(0, 500),
      projectKey,
      createdAt: Date.now()
    })
    if (input.learnRule) {
      const titleMatch = input.titleMatch === 'exact' ? 'exact' : 'contains'
      const titlePattern = (input.titlePattern ?? input.title).trim().replace(/\s+/g, ' ').slice(0, 300)
      if (meaningfulRulePattern(titlePattern)) {
        const duplicate = store.getClassificationRules().some((rule) => rule.enabled
          && rule.projectKey === projectKey
          && rule.app.toLocaleLowerCase() === input.app.trim().toLocaleLowerCase()
          && rule.titleMatch === titleMatch
          && rule.titlePattern.toLocaleLowerCase() === titlePattern.toLocaleLowerCase())
        if (!duplicate) store.addClassificationRule({
          id: randomUUID(), projectKey, app: input.app.trim().slice(0, 200), titleMatch, titlePattern,
          enabled: true, createdAt: Date.now(), appliesFrom: Date.now()
        })
      }
    }
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.removeActivityCorrection, async (_event, input: RemoveActivityCorrectionInput) => {
    if (!validDate(input?.date) || typeof input?.overrideId !== 'string') throw new Error('撤销纠错参数无效')
    store.removeActivityOverride(input.date, input.overrideId)
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.addIdleOverride, async (_event, input: { date?: unknown; start?: unknown; end?: unknown }) => {
    if (!validDate(input?.date) || typeof input?.start !== 'string' || typeof input?.end !== 'string') throw new Error('低交互纠错参数无效')
    const start = Date.parse(input.start)
    const end = Date.parse(input.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 24 * 60 * 60 * 1000) throw new Error('低交互纠错时间范围无效')
    const current = await activityDetails(input.date)
    const selected = current.entries.find((entry) => entry.attribution === 'afk' && entry.start === input.start && entry.end === input.end)
    if (!selected) throw new Error('这段离开记录已经变化，请刷新后重试')
    store.addIdleOverride({ id: randomUUID(), date: input.date, start: input.start, end: input.end, createdAt: Date.now() })
    applyIdlePolicy()
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.removeIdleOverride, async (_event, input: { date?: unknown; overrideId?: unknown }) => {
    if (!validDate(input?.date) || typeof input?.overrideId !== 'string') throw new Error('撤销低交互纠错参数无效')
    store.removeIdleOverride(input.date, input.overrideId)
    applyIdlePolicy()
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.setActivityRuleEnabled, async (_event, input: { date?: unknown; ruleId?: unknown; enabled?: unknown }) => {
    if (!validDate(input?.date) || typeof input?.ruleId !== 'string' || typeof input?.enabled !== 'boolean') throw new Error('规则参数无效')
    store.setClassificationRuleEnabled(input.ruleId, input.enabled)
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.moveActivityRule, async (_event, input: MoveActivityRuleInput) => {
    if (!validDate(input?.date) || typeof input?.ruleId !== 'string' || (input?.direction !== 'up' && input?.direction !== 'down')) throw new Error('规则排序参数无效')
    store.moveClassificationRule(input.ruleId, input.direction)
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.removeActivityRule, async (_event, input: { date?: unknown; ruleId?: unknown }) => {
    if (!validDate(input?.date) || typeof input?.ruleId !== 'string') throw new Error('删除规则参数无效')
    store.removeClassificationRule(input.ruleId)
    return activityDetails(input.date)
  })
  ipcMain.handle(IPC.getInsights, (_event, days: unknown) => {
    if (days !== 7 && days !== 14 && days !== 30) throw new Error('个人规律时间范围无效')
    return personalInsights(days)
  })
  ipcMain.handle(IPC.getWorkActivity, (_event, mode: unknown) => {
    if (mode !== 'day' && mode !== 'week' && mode !== 'month') throw new Error('工作活动时间范围无效')
    return workActivityDashboard(mode)
  })
  ipcMain.handle(IPC.showWindow, () => showWindow())
  ipcMain.handle(IPC.showWidget, () => showWidget())
  ipcMain.handle(IPC.hideWidget, () => widgetWindow?.hide())
  ipcMain.handle(IPC.setWidgetExpanded, (_event, expanded: unknown) => {
    if (typeof expanded !== 'boolean') throw new Error('悬浮窗展开状态无效')
    return setWidgetExpanded(expanded)
  })
  ipcMain.handle(IPC.completeOnboarding, () => store.updateSettings({ onboardingCompletedAt: new Date().toISOString() }))
  ipcMain.handle(IPC.getPrivacyRules, () => store.getPrivacyRules())
  ipcMain.handle(IPC.addPrivacyRule, (_event, input: { app?: unknown; titlePattern?: unknown }) => {
    if (typeof input?.app !== 'string' || typeof input?.titlePattern !== 'string' || !input.app.trim() || !input.titlePattern.trim()) {
      throw new Error('隐私规则需要应用名和窗口标题条件')
    }
    return store.addPrivacyRule({ id: randomUUID(), app: input.app.trim().slice(0, 120), titlePattern: input.titlePattern.trim().slice(0, 200), enabled: true, createdAt: Date.now() })
  })
  ipcMain.handle(IPC.setPrivacyRuleEnabled, (_event, input: { ruleId?: unknown; enabled?: unknown }) => {
    if (typeof input?.ruleId !== 'string' || typeof input?.enabled !== 'boolean') throw new Error('隐私规则参数无效')
    return store.setPrivacyRuleEnabled(input.ruleId, input.enabled)
  })
  ipcMain.handle(IPC.removePrivacyRule, (_event, input: { ruleId?: unknown }) => {
    if (typeof input?.ruleId !== 'string') throw new Error('隐私规则参数无效')
    return store.removePrivacyRule(input.ruleId)
  })
  ipcMain.handle(IPC.exportBackup, async () => {
    const options = {
      title: '导出本地应用数据备份', defaultPath: `时间效率助手-备份-${localDateKey()}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { path: null }
    writeFileSync(result.filePath, JSON.stringify(createBackupEnvelope(store.exportData()), null, 2), 'utf8')
    return { path: result.filePath }
  })
  ipcMain.handle(IPC.importBackup, async () => {
    const options = { title: '恢复本地应用数据备份', properties: ['openFile'] as ('openFile')[], filters: [{ name: 'JSON 备份', extensions: ['json'] }] }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return { restored: false, recoveryPath: null }
    const backup = parseBackupEnvelope(readFileSync(result.filePaths[0], 'utf8'))
    const recoveryPath = join(app.getPath('userData'), `time-efficiency-recovery-${Date.now()}.json`)
    store.restoreData(backup.appData, recoveryPath)
    applyIdlePolicy()
    activityWatch.invalidateWorkdayCache()
    invalidateWorkActivityCache()
    return { restored: true, recoveryPath }
  })
  ipcMain.handle(IPC.exportAggregatedCsv, async () => {
    const options = {
      title: '导出聚合复盘 CSV', defaultPath: `时间效率助手-复盘-${localDateKey()}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { path: null }
    writeFileSync(result.filePath, `\ufeff${buildAggregatedCsv(store.exportData())}`, 'utf8')
    return { path: result.filePath }
  })
  ipcMain.handle(IPC.exportDiagnostics, async () => {
    const options = {
      title: '导出脱敏诊断包', defaultPath: `时间效率助手-诊断-${localDateKey()}.json`, filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { path: null }
    const report = {
      format: 'time-efficiency-diagnostics', version: app.getVersion(), platform: process.platform,
      exportedAt: new Date().toISOString(), storageSchema: store.exportData().version,
      privacyRuleCount: store.getPrivacyRules().length, classificationRuleCount: store.getClassificationRules().length,
      signed: false, updatePolicy: 'no-auto-update',
      diagnostics: Object.fromEntries(Object.entries(await diagnostics()).map(([key, value]) => [key, { ok: value.ok }]))
    }
    writeFileSync(result.filePath, JSON.stringify(report, null, 2), 'utf8')
    return { path: result.filePath }
  })
}

async function checkReminders(): Promise<void> {
  const date = await currentWorkdayKey()
  const state = reminderState(store.getRecord(date), store.getSettings())
  const notify = (phase: 'morning' | 'evening', title: string, body: string) => {
    const key = `${date}:${phase}`
    if (notified.has(key)) return
    notified.add(key)
    const notification = new Notification({ title, body })
    notification.on('click', showWindow)
    notification.show()
  }
  if (state.morningDue) notify('morning', '该确认今天最重要的事了', '最多 3 个成果，先选出唯一绝对优先项。')
  if (state.eveningDue) notify('evening', '今天还没有复盘', '用 5 分钟对照真实电脑记录，决定明天怎么调整。')
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', showWindow)
  app.whenReady().then(async () => {
    store = new AppStore(join(app.getPath('userData'), 'time-efficiency-data.json'))
    workActivityFactsCache = new WorkActivityFactsCache(join(app.getPath('userData'), 'work-activity-facts-v1.json'))
    activityWatch = new ActivityWatchManager(runtimeRoot())
    const settings = store.getSettings()
    activityWatch.setIdlePolicy(settings.idleThresholdMinutes, store.getIdleOverrides())
    codexContextTracker = new CodexContextTracker(activityWatch, new CodexAppServerClient(), store)
    applyLaunchAtLogin(settings.launchAtLogin)
    registerIpc()
    codexContextTracker.start(() => currentWorkdayKey())
    createWindow()
    createWidgetWindow()
    if (!e2eMode) createTray()
    void activityWatch.ensureStarted(settings.trackingEnabled)
      .catch((error) => console.error('ActivityWatch startup failed:', error))
      .finally(() => activityWatch.startMonitoring())
    if (!e2eMode) {
      void checkReminders()
      setInterval(() => void checkReminders(), 60_000)
    }
  })
}

app.on('before-quit', () => {
  quitting = true
  if (widgetPositionTimer) clearTimeout(widgetPositionTimer)
  codexContextTracker?.stop()
  activityWatch?.stopAll()
})

app.on('activate', showWindow)
