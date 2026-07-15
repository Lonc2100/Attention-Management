import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'
import type { AfkNote, PlanInput, ReviewInput, Settings } from '../shared/contracts'
import { IPC } from '../shared/contracts'
import { ActivityWatchManager } from './activitywatch'
import { CodexAppServerClient } from './codex-app-server'
import { CodexContextTracker } from './codex-context-tracker'
import { codexDiagnostics, runCodexReview } from './codex'
import { localDateKey, reminderState } from './date'
import { AppStore } from './store'
import { applyWidgetMode, widgetBounds, WIDGET_SIZE } from './floating-window'

let window: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let store: AppStore
let activityWatch: ActivityWatchManager
let codexContextTracker: CodexContextTracker
let widgetPositionTimer: NodeJS.Timeout | null = null
const notified = new Set<string>()
const e2eMode = process.env.TIME_EFFICIENCY_E2E === '1'
const startHidden = process.argv.includes('--hidden')

function runtimeRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'activitywatch') : join(app.getAppPath(), 'runtime', 'activitywatch')
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
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
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
    transparent: true,
    resizable: false,
    hasShadow: true,
    skipTaskbar: true,
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
  else void widgetWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'widget' } })
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
  const [server, windowWatcher, afkWatcher, codex] = await Promise.all([
    activityWatch.health(),
    activityWatch.bucketHealth('currentwindow'),
    activityWatch.bucketHealth('afkstatus'),
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
  const record = store.getRecord(date)
  return activityWatch.getSummary(
    date,
    record.afkNotes,
    store.getCodexContextSamples(date),
    store.getProjectAliases(),
    codexContextTracker?.getStatus()
  )
}

async function bootstrap() {
  const date = localDateKey()
  const record = store.getRecord(date)
  const settings = store.getSettings()
  return {
    date,
    record,
    settings,
    activity: await activitySummary(date),
    reminders: reminderState(record, settings),
    diagnostics: await diagnostics()
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.bootstrap, bootstrap)
  ipcMain.handle(IPC.refreshActivity, async (_event, date?: string) => {
    const key = date || localDateKey()
    return activitySummary(key)
  })
  ipcMain.handle(IPC.savePlan, (_event, input: PlanInput) => {
    const outcomes = input.outcomes.map((item) => ({ ...item, title: item.title.trim() })).filter((item) => item.title).slice(0, 3)
    if (!outcomes.length) throw new Error('至少填写一个重要成果')
    if (!outcomes.some((item) => item.id === input.priorityOutcomeId)) throw new Error('请选择一个绝对优先项')
    return store.updateRecord(localDateKey(), (record) => ({
      ...record,
      outcomes,
      priorityOutcomeId: input.priorityOutcomeId,
      planCompletedAt: new Date().toISOString()
    }))
  })
  ipcMain.handle(IPC.saveReview, (_event, input: ReviewInput) => {
    if (input.subjectiveScore < 1 || input.subjectiveScore > 5) throw new Error('主观效率评分必须在 1–5 之间')
    return store.updateRecord(localDateKey(), (record) => ({
      ...record,
      review: { ...input, summary: input.summary.trim(), tomorrowIntent: input.tomorrowIntent.trim(), completedAt: new Date().toISOString() }
    }))
  })
  ipcMain.handle(IPC.saveAfkNote, (_event, input: AfkNote) =>
    store.updateRecord(localDateKey(), (record) => ({
      ...record,
      afkNotes: [...record.afkNotes.filter((note) => note.id !== input.id), { ...input, note: input.note.trim() }]
    }))
  )
  ipcMain.handle(IPC.updateSettings, (_event, patch: Partial<Settings>) => {
    const settings = store.updateSettings(patch)
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
    const date = localDateKey()
    return activitySummary(date)
  })
  ipcMain.handle(IPC.runAiReview, async () => {
    const date = localDateKey()
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
    return activitySummary(localDateKey())
  })
  ipcMain.handle(IPC.showWindow, () => showWindow())
  ipcMain.handle(IPC.showWidget, () => showWidget())
  ipcMain.handle(IPC.hideWidget, () => widgetWindow?.hide())
  ipcMain.handle(IPC.setWidgetExpanded, (_event, expanded: unknown) => {
    if (typeof expanded !== 'boolean') throw new Error('悬浮窗展开状态无效')
    return setWidgetExpanded(expanded)
  })
}

function checkReminders(): void {
  const date = localDateKey()
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
    activityWatch = new ActivityWatchManager(runtimeRoot())
    codexContextTracker = new CodexContextTracker(activityWatch, new CodexAppServerClient(), store)
    const settings = store.getSettings()
    applyLaunchAtLogin(settings.launchAtLogin)
    registerIpc()
    try {
      await activityWatch.ensureStarted(settings.trackingEnabled)
    } catch (error) {
      console.error('ActivityWatch startup failed:', error)
    }
    codexContextTracker.start(() => localDateKey())
    createWindow()
    createWidgetWindow()
    if (!e2eMode) createTray()
    if (!e2eMode) {
      checkReminders()
      setInterval(checkReminders, 60_000)
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
