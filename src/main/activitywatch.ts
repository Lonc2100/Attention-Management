import { existsSync, readdirSync, statfsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type {
  ActivityEvent,
  ActivityDetails,
  ActivityOverride,
  ActivityRule,
  ActivitySummary,
  AfkNote,
  CodexContextSample,
  CodexContextStatus,
  PrivacyRule,
  WorkdayBoundaryInfo
} from '../shared/contracts'
import type { DailyWorkActivity } from '../shared/work-activity'
import {
  buildWorkdayModel,
  currentWorkdayKey as modelCurrentWorkdayKey,
  workdayRange,
  type ActiveInterval,
  type WorkdayModel
} from '../shared/workday'
import { aggregateActivity, disconnectedSummary } from './aggregate'
import { classifyActivityDay } from './classification'
import { dayBounds, localDateKey } from './date'
import { identityForSample } from './project-attribution'
import { launchActivityWatchProcess, type ActivityWatchChild } from './activitywatch-process'
import {
  CollectorRecoveryPolicy,
  CRITICAL_DISK_BYTES,
  DISK_WARNING_BYTES,
  type RecoveryAction
} from './collector-recovery'

interface Bucket {
  id: string
  type: string
  hostname?: string
  client?: string
  created?: string
  last_updated?: string
  metadata?: {
    start?: string
    end?: string
  }
}

interface ManagedProcess {
  name: string
  process: ActivityWatchChild
}

export interface CurrentActivityState {
  app: string
  title: string
  isAfk: boolean
  fresh?: boolean
  startedAt?: string | null
}

interface ActivityWatchManagerOptions {
  now?: () => number
  freeDiskBytes?: () => number
}

interface HealthResult {
  ok: boolean
  detail: string
}

interface ResolvedWorkday {
  model: WorkdayModel
  range: { start: number; end: number } | null
  info: WorkdayBoundaryInfo | undefined
}

const API = 'http://127.0.0.1:5600/api/0'

function findExecutable(root: string, names: string[]): string | null {
  if (!existsSync(root)) return null
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      if (entry.isFile() && wanted.has(entry.name.toLowerCase())) return full
    }
  }
  return null
}

async function waitForServer(timeoutMs = 20_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${API}/info`, { signal: AbortSignal.timeout(1500) })
      if (response.ok) return
    } catch {
      // Retry while bundled server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('ActivityWatch 服务在 20 秒内未就绪')
}

export class ActivityWatchManager {
  private owned: ManagedProcess[] = []
  private readonly stopping = new WeakSet<ActivityWatchChild>()
  private readonly recoveryPolicy = new CollectorRecoveryPolicy()
  private readonly now: () => number
  private readonly freeDiskBytes: () => number
  private readonly startedAt: number
  private tracking = true
  private serverOwnedByApp = false
  private processFault: string | null = null
  private monitorTimer: NodeJS.Timeout | null = null
  private maintenanceRunning = false
  private recoveryStatus: HealthResult = { ok: true, detail: '尚未触发恢复' }
  private lastResolvedWorkdayKey: string | null = null
  private currentWorkdayCache: { expiresAt: number; overrideKey: string; value: string } | null = null

  constructor(private readonly runtimeRoot: string, options: ActivityWatchManagerOptions = {}) {
    this.now = options.now ?? Date.now
    this.freeDiskBytes = options.freeDiskBytes ?? (() => {
      const stats = statfsSync(process.env.LOCALAPPDATA ?? homedir())
      return Number(stats.bavail) * Number(stats.bsize)
    })
    this.startedAt = this.now()
  }

  async ensureStarted(tracking: boolean): Promise<void> {
    this.tracking = tracking
    let serverReady = false
    try {
      await waitForServer(1200)
      serverReady = true
    } catch {
      serverReady = false
    }

    if (!serverReady) {
      const server = findExecutable(this.runtimeRoot, ['aw-server.exe', 'aw-server-rust.exe'])
      if (!server) throw new Error(`ActivityWatch server 未找到：${this.runtimeRoot}`)
      this.serverOwnedByApp = true
      this.startProcess('server', server)
      await waitForServer()
    }

    if (tracking) this.startWatchers()
    this.processFault = null
  }

  async setTracking(enabled: boolean): Promise<void> {
    this.tracking = enabled
    if (enabled) {
      await this.ensureStarted(true)
    } else {
      this.stopOwned(['window', 'afk'])
    }
  }

  async getSummary(
    date: string,
    notes: AfkNote[],
    contextSamples: CodexContextSample[] = [],
    projectAliases: Record<string, string> = {},
    codexContext?: CodexContextStatus,
    rules: ActivityRule[] = [],
    overrides: ActivityOverride[] = [],
    manualProjects: Record<string, string> = {},
    privacyRules: PrivacyRule[] = [],
    workdayOverrides: Record<string, string> = {}
  ): Promise<ActivitySummary> {
    try {
      await waitForServer(1500)
      const buckets = await this.getBuckets()
      const windowBucket = this.newestBucket(buckets, 'currentwindow')
      const afkBucket = this.newestBucket(buckets, 'afkstatus')
      const resolved = await this.resolveWorkday(date, workdayOverrides, buckets)
      const [windowEvents, afkEvents] = await Promise.all([
        windowBucket && resolved.range ? this.getEventsRange(windowBucket.id, resolved.range.start, resolved.range.end) : Promise.resolve([]),
        afkBucket && resolved.range ? this.getEventsRange(afkBucket.id, resolved.range.start, resolved.range.end) : Promise.resolve([])
      ])
      const liveState = modelCurrentWorkdayKey(resolved.model, this.now()) === date
        ? await this.getCurrentState()
        : undefined
      return {
        ...aggregateActivity(
        windowEvents,
        afkEvents,
        notes,
        this.tracking,
        { window: windowBucket?.id ?? null, afk: afkBucket?.id ?? null },
        contextSamples,
        projectAliases,
        codexContext,
        Date.now(),
        rules,
        overrides,
        manualProjects,
        privacyRules,
        liveState
        ),
        workday: resolved.info
      }
    } catch (error) {
      return disconnectedSummary(this.tracking, error)
    }
  }

  async getDailyActiveDurations(dates: string[], workdayOverrides: Record<string, string> = {}): Promise<DailyWorkActivity[]> {
    if (dates.length === 0) return []
    await waitForServer(1500)
    const buckets = await this.getBuckets()
    const windowBucket = this.newestBucket(buckets, 'currentwindow')
    const afkBucket = this.newestBucket(buckets, 'afkstatus')
    if (!windowBucket || !afkBucket) throw new Error('ActivityWatch 窗口或 AFK 数据源不可用')

    const sorted = [...dates].sort()
    const queryStart = Date.parse(dayBounds(this.shiftDate(sorted[0]!, -2)).start)
    const queryEnd = Math.min(Date.parse(dayBounds(this.shiftDate(sorted.at(-1)!, 2)).end), this.now() + 60_000)
    const intervals = await this.getActiveIntervalsBatched(windowBucket.id, afkBucket.id, queryStart, queryEnd)
    const model = buildWorkdayModel(intervals, workdayOverrides)
    const values = new Map<string, DailyWorkActivity>(dates.map((date) => [date, { date, activeSeconds: 0, observedSeconds: 0, lastActiveAt: null, available: true }]))
    for (const allocation of model.allocations) {
      const current = values.get(allocation.workdayKey)
      if (!current) continue
      const seconds = Math.max(0, (allocation.end - allocation.start) / 1000)
      current.activeSeconds += seconds
      current.observedSeconds += seconds
      const previousEnd = Date.parse(current.lastActiveAt ?? '')
      current.lastActiveAt = new Date(Number.isFinite(previousEnd) ? Math.max(previousEnd, allocation.end) : allocation.end).toISOString()
    }
    return dates.map((date) => values.get(date)!)
  }

  async getCurrentWorkday(workdayOverrides: Record<string, string> = {}, persistedFallback: string | null = null): Promise<string> {
    const overrideKey = JSON.stringify(workdayOverrides)
    if (this.currentWorkdayCache && this.currentWorkdayCache.expiresAt > this.now() && this.currentWorkdayCache.overrideKey === overrideKey) {
      return this.currentWorkdayCache.value
    }
    try {
      await waitForServer(1500)
      const buckets = await this.getBuckets()
      const windowBucket = this.newestBucket(buckets, 'currentwindow')
      const afkBucket = this.newestBucket(buckets, 'afkstatus')
      if (!windowBucket || !afkBucket) throw new Error('ActivityWatch 窗口或 AFK 数据源不可用')
      const intervals = await this.getActiveIntervalsBatched(
        windowBucket.id,
        afkBucket.id,
        this.now() - 14 * 24 * 60 * 60 * 1000,
        this.now() + 60_000
      )
      const key = modelCurrentWorkdayKey(buildWorkdayModel(intervals, workdayOverrides), this.now()) ?? localDateKey(new Date(this.now()))
      this.lastResolvedWorkdayKey = key
      this.currentWorkdayCache = { expiresAt: this.now() + 60_000, overrideKey, value: key }
      return key
    } catch {
      return this.lastResolvedWorkdayKey ?? persistedFallback ?? localDateKey(new Date(this.now()))
    }
  }

  invalidateWorkdayCache(): void {
    this.currentWorkdayCache = null
  }

  private async queryActiveIntervals(
    windowBucketId: string,
    afkBucketId: string,
    start: number,
    end: number
  ): Promise<ActiveInterval[]> {
    if (end <= start) return []
    const query = [
      `events = flood(query_bucket(${JSON.stringify(windowBucketId)}));`,
      `not_afk = flood(query_bucket(${JSON.stringify(afkBucketId)}));`,
      'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
      'active_events = filter_period_intersect(events, not_afk);',
      'RETURN = period_union(active_events, []);'
    ]
    const response = await fetch(`${API}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, timeperiods: [`${new Date(start).toISOString()}/${new Date(end).toISOString()}`] }),
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`读取 ActivityWatch 区间统计失败：HTTP ${response.status}`)
    const values = await response.json() as ActivityEvent[][]
    if (!Array.isArray(values) || !Array.isArray(values[0])) throw new Error('ActivityWatch 活动区间返回格式异常')
    return values[0].flatMap((event) => {
      const eventStart = Date.parse(event.timestamp)
      const eventEnd = eventStart + Number(event.duration) * 1000
      return Number.isFinite(eventStart) && Number.isFinite(eventEnd) && eventEnd > eventStart
        ? [{ start: eventStart, end: eventEnd }]
        : []
    })
  }

  private async getActiveIntervalsBatched(
    windowBucketId: string,
    afkBucketId: string,
    start: number,
    end: number
  ): Promise<ActiveInterval[]> {
    const intervals: ActiveInterval[] = []
    let cursor = start
    const batchMs = 31 * 24 * 60 * 60 * 1000
    while (cursor < end) {
      const batchEnd = Math.min(end, cursor + batchMs)
      intervals.push(...await this.queryActiveIntervals(windowBucketId, afkBucketId, cursor, batchEnd))
      cursor = batchEnd
    }
    return intervals
  }

  private async resolveWorkday(date: string, workdayOverrides: Record<string, string>, buckets?: Bucket[]): Promise<ResolvedWorkday> {
    const availableBuckets = buckets ?? await this.getBuckets()
    const windowBucket = this.newestBucket(availableBuckets, 'currentwindow')
    const afkBucket = this.newestBucket(availableBuckets, 'afkstatus')
    if (!windowBucket || !afkBucket) throw new Error('ActivityWatch 窗口或 AFK 数据源不可用')
    const start = Date.parse(dayBounds(this.shiftDate(date, -3)).start)
    const end = Math.min(Date.parse(dayBounds(this.shiftDate(date, 3)).end), this.now() + 60_000)
    const model = buildWorkdayModel(
      await this.getActiveIntervalsBatched(windowBucket.id, afkBucket.id, start, end),
      workdayOverrides
    )
    const boundary = model.boundaries.find((item) => item.workdayKey === date)
    return {
      model,
      range: workdayRange(model, date),
      info: boundary ? { workdayKey: date, startsAt: new Date(boundary.at).toISOString(), source: boundary.source } : undefined
    }
  }

  private shiftDate(date: string, days: number): string {
    const value = new Date(`${date}T12:00:00`)
    value.setDate(value.getDate() + days)
    return localDateKey(value)
  }

  async getDetails(
    date: string,
    contextSamples: CodexContextSample[] = [],
    projectAliases: Record<string, string> = {},
    rules: ActivityRule[] = [],
    overrides: ActivityOverride[] = [],
    manualProjects: Record<string, string> = {},
    privacyRules: PrivacyRule[] = [],
    workdayOverrides: Record<string, string> = {}
  ): Promise<ActivityDetails> {
    try {
      await waitForServer(1500)
      const buckets = await this.getBuckets()
      const windowBucket = this.newestBucket(buckets, 'currentwindow')
      const afkBucket = this.newestBucket(buckets, 'afkstatus')
      const resolved = await this.resolveWorkday(date, workdayOverrides, buckets)
      const [windowEvents, afkEvents] = await Promise.all([
        windowBucket && resolved.range ? this.getEventsRange(windowBucket.id, resolved.range.start, resolved.range.end) : Promise.resolve([]),
        afkBucket && resolved.range ? this.getEventsRange(afkBucket.id, resolved.range.start, resolved.range.end) : Promise.resolve([])
      ])
      const classified = classifyActivityDay(windowEvents, afkEvents, contextSamples, projectAliases, rules, overrides, manualProjects)
      const privateEntry = (entry: ActivityDetails['entries'][number]) => privacyRules.some((rule) => rule.enabled
        && rule.app.trim().toLocaleLowerCase() === entry.app.trim().toLocaleLowerCase()
        && entry.title.toLocaleLowerCase().includes(rule.titlePattern.trim().toLocaleLowerCase()))
      const entries = classified.entries.map((entry) => privateEntry(entry) ? {
        ...entry, id: `private:${entry.start}:${entry.end}`, app: '已隐藏活动', title: '已按隐私规则隐藏',
        projectKey: null, projectLabel: '已隐藏活动', attribution: 'application' as const,
        ruleId: null, overrideId: null, classified: false, correctable: false
      } : entry)
      const projectOptions = new Map<string, { key: string; label: string; source: 'folder' | 'thread' | 'fallback' | 'alias' | 'manual' }>()
      for (const sample of contextSamples) {
        const identity = identityForSample(sample, projectAliases)
        projectOptions.set(identity.key, { key: identity.key, label: identity.label, source: identity.source })
      }
      for (const [key, label] of Object.entries(manualProjects)) projectOptions.set(key, { key, label, source: 'manual' })
      for (const rule of rules) {
        if (projectOptions.has(rule.projectKey)) continue
        const label = projectAliases[rule.projectKey]?.trim()
        if (label) projectOptions.set(rule.projectKey, { key: rule.projectKey, label, source: 'alias' })
      }
      const rangeStart = entries[0]?.start ?? null
      const rangeEnd = entries[entries.length - 1]?.end ?? null
      const partial = !afkBucket
      return {
        date,
        connected: true,
        tracking: this.tracking,
        rangeStart,
        rangeEnd,
        activeSeconds: classified.activeSeconds,
        afkSeconds: classified.afkSeconds,
        entries,
        projectOptions: [...projectOptions.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
        rules,
        workday: resolved.info,
        partial,
        warning: partial ? 'AFK 数据暂不可用，以下活动可能包含离开电脑的时间。' : null,
        error: null,
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        date,
        connected: false,
        tracking: this.tracking,
        rangeStart: null,
        rangeEnd: null,
        activeSeconds: 0,
        afkSeconds: 0,
        entries: [],
        projectOptions: [],
        rules,
        partial: false,
        warning: null,
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString()
      }
    }
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const response = await fetch(`${API}/info`, { signal: AbortSignal.timeout(1500) })
      if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
      const info = (await response.json()) as { version?: string; hostname?: string }
      const data = await this.dataHealth()
      return data.ok
        ? { ok: true, detail: `v${info.version ?? 'unknown'} · ${data.detail}` }
        : data
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }

  async dataHealth(requireFresh = false): Promise<HealthResult> {
    if (this.processFault) return { ok: false, detail: this.processFault }
    try {
      const buckets = await this.getBuckets()
      const required = ['currentwindow', 'afkstatus']
        .map((type) => this.newestBucket(buckets, type))
      if (required.some((bucket) => !bucket)) return { ok: false, detail: '窗口或 AFK 采集桶缺失' }
      if (!this.tracking) return { ok: true, detail: '采集已暂停，数据桶可读取' }
      if (!requireFresh && this.now() - this.startedAt < 60_000) return { ok: true, detail: '采集启动宽限期' }
      const stale = required.find((bucket) => {
        const updatedAt = this.bucketUpdatedAt(bucket)
        return !Number.isFinite(updatedAt) || updatedAt < this.now() - this.freshnessLimitMs(bucket?.type)
      })
      if (stale) {
        const seconds = this.freshnessLimitMs(stale.type) / 1000
        return { ok: false, detail: `${stale.type} 超过 ${seconds} 秒没有新事件` }
      }
      return { ok: true, detail: '数据桶持续更新' }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }

  diskHealth(): HealthResult & { freeBytes: number; critical: boolean } {
    try {
      const freeBytes = this.freeDiskBytes()
      const gib = freeBytes / (1024 ** 3)
      if (freeBytes < CRITICAL_DISK_BYTES) {
        return { ok: false, critical: true, freeBytes, detail: `系统盘仅剩 ${gib.toFixed(1)} GiB，已暂停自动恢复` }
      }
      if (freeBytes < DISK_WARNING_BYTES) {
        return { ok: false, critical: false, freeBytes, detail: `系统盘仅剩 ${gib.toFixed(1)} GiB，请尽快清理` }
      }
      return { ok: true, critical: false, freeBytes, detail: `系统盘可用 ${gib.toFixed(1)} GiB` }
    } catch (error) {
      return { ok: false, critical: false, freeBytes: Number.POSITIVE_INFINITY, detail: `无法读取磁盘空间：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  recoveryHealth(): HealthResult {
    return this.recoveryStatus
  }

  async bucketHealth(type: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const bucket = this.newestBucket(await this.getBuckets(), type)
      if (!bucket) return { ok: false, detail: `没有 ${type} 采集桶` }
      if (this.tracking && this.now() - this.startedAt >= 60_000) {
        const updatedAt = this.bucketUpdatedAt(bucket)
        const freshnessLimitMs = this.freshnessLimitMs(bucket.type)
        if (!Number.isFinite(updatedAt) || updatedAt < this.now() - freshnessLimitMs) {
          return { ok: false, detail: `${bucket.id} 超过 ${freshnessLimitMs / 1000} 秒没有更新` }
        }
      }
      return { ok: true, detail: bucket.id }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }

  async getCurrentState(): Promise<CurrentActivityState> {
    await waitForServer(1500)
    const buckets = await this.getBuckets()
    const windowBucket = this.newestBucket(buckets, 'currentwindow')
    const afkBucket = this.newestBucket(buckets, 'afkstatus')
    if (!windowBucket || !afkBucket) {
      return { app: '', title: '', isAfk: true, fresh: false }
    }
    const [windowEvent, afkEvent] = await Promise.all([
      this.getLatestEvent(windowBucket.id),
      this.getLatestEvent(afkBucket.id)
    ])
    const now = Date.now()
    const windowFresh = windowEvent ? this.eventEnd(windowEvent) >= now - 15_000 : false
    const afkFresh = afkEvent ? this.eventEnd(afkEvent) >= now - 15_000 : false
    if (!windowEvent || !windowFresh || !afkEvent || !afkFresh) {
      return { app: '', title: '', isAfk: true, fresh: false }
    }
    return {
      app: windowEvent.data.app ?? '',
      title: windowEvent.data.title ?? '',
      isAfk: afkEvent.data.status === 'afk',
      fresh: true,
      startedAt: afkEvent.data.status === 'afk' ? afkEvent.timestamp : null
    }
  }

  stopAll(): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer)
    this.monitorTimer = null
    this.stopOwned(this.owned.map((item) => item.name))
    this.serverOwnedByApp = false
  }

  startMonitoring(intervalMs = 30_000): void {
    if (this.monitorTimer) return
    this.monitorTimer = setInterval(() => void this.maintain(), intervalMs)
  }

  async maintain(): Promise<void> {
    if (this.maintenanceRunning) return
    this.maintenanceRunning = true
    try {
      const [data, disk] = await Promise.all([this.dataHealth(), Promise.resolve(this.diskHealth())])
      const decision = this.recoveryPolicy.evaluate({
        healthy: data.ok,
        freeBytes: disk.freeBytes,
        ownsServer: this.serverOwnedByApp,
        now: this.now()
      })
      this.recoveryStatus = this.describeRecovery(decision.action, decision.retryAfterMs, data.detail)
      if (decision.action !== 'restart') return
      await this.stopOwnedAndWait(['window', 'afk', 'server'])
      await this.waitForServerDown()
      await this.ensureStarted(this.tracking)
      await this.waitForFreshData()
      this.recoveryStatus = { ok: true, detail: '采集器已受控重启并恢复新事件' }
    } catch (error) {
      this.recoveryStatus = { ok: false, detail: `自动恢复失败：${error instanceof Error ? error.message : String(error)}` }
    } finally {
      this.maintenanceRunning = false
    }
  }

  private startWatchers(): void {
    const windowWatcher = findExecutable(this.runtimeRoot, ['aw-watcher-window.exe'])
    const afkWatcher = findExecutable(this.runtimeRoot, ['aw-watcher-afk.exe'])
    if (!windowWatcher || !afkWatcher) {
      throw new Error('ActivityWatch 窗口或 AFK watcher 未找到')
    }
    if (!this.owned.some((item) => item.name === 'window')) this.startProcess('window', windowWatcher)
    if (!this.owned.some((item) => item.name === 'afk')) this.startProcess('afk', afkWatcher)
  }

  private startProcess(name: string, executable: string): void {
    const child = launchActivityWatchProcess({
      name,
      executable,
      onExit: (code, signal) => {
        this.owned = this.owned.filter((item) => item.process !== child)
        if (!this.stopping.has(child) && this.tracking) {
          this.processFault = `${name} 进程意外退出（code=${code ?? 'null'}, signal=${signal ?? 'none'}）`
        }
      }
    })
    this.owned.push({ name, process: child })
    console.log(`Started ActivityWatch ${name}: ${basename(executable)}`)
  }

  private stopOwned(names: string[]): void {
    const set = new Set(names)
    for (const item of this.owned.filter((candidate) => set.has(candidate.name))) {
      this.stopping.add(item.process)
      item.process.kill()
    }
    this.owned = this.owned.filter((item) => !set.has(item.name))
  }

  private async stopOwnedAndWait(names: string[]): Promise<void> {
    const set = new Set(names)
    const targets = this.owned.filter((candidate) => set.has(candidate.name))
    for (const item of targets) {
      this.stopping.add(item.process)
      item.process.kill()
    }
    this.owned = this.owned.filter((item) => !set.has(item.name))
    await Promise.all(targets.map(async (item) => {
      if (item.process.exitCode !== null && item.process.exitCode !== undefined) return
      const exited = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1500)
        item.process.once('exit', () => {
          clearTimeout(timer)
          resolve(true)
        })
      })
      if (!exited && item.process.exitCode === null) item.process.kill('SIGKILL')
    }))
  }

  private async getBuckets(): Promise<Bucket[]> {
    const response = await fetch(`${API}/buckets/`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`读取 ActivityWatch buckets 失败：HTTP ${response.status}`)
    const data = (await response.json()) as Record<string, Omit<Bucket, 'id'>>
    return Object.entries(data).map(([id, bucket]) => ({ ...bucket, id }))
  }

  private newestBucket(buckets: Bucket[], type: string): Bucket | undefined {
    return buckets
      .filter((bucket) => bucket.type === type)
      .sort((a, b) => this.bucketUpdatedAt(b) - this.bucketUpdatedAt(a))[0]
  }

  private bucketUpdatedAt(bucket: Bucket | undefined): number {
    if (!bucket) return Number.NEGATIVE_INFINITY
    for (const value of [bucket.metadata?.end, bucket.last_updated, bucket.created]) {
      const parsed = Date.parse(value ?? '')
      if (Number.isFinite(parsed)) return parsed
    }
    return Number.NEGATIVE_INFINITY
  }

  private freshnessLimitMs(type: string | undefined): number {
    // AFK events are written after the idle transition and can legitimately
    // remain unchanged for the configured idle timeout (normally 3 minutes).
    return type === 'afkstatus' ? 300_000 : 120_000
  }

  private async getEventsRange(bucketId: string, start: number, end: number): Promise<ActivityEvent[]> {
    const params = new URLSearchParams({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), limit: '-1' })
    const response = await fetch(`${API}/buckets/${encodeURIComponent(bucketId)}/events?${params}`, {
      signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) throw new Error(`读取 ActivityWatch events 失败：HTTP ${response.status}`)
    return (await response.json()) as ActivityEvent[]
  }

  private async getLatestEvent(bucketId: string): Promise<ActivityEvent | null> {
    const response = await fetch(`${API}/buckets/${encodeURIComponent(bucketId)}/events?limit=1`, {
      signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) throw new Error(`读取 ActivityWatch 当前状态失败：HTTP ${response.status}`)
    const events = (await response.json()) as ActivityEvent[]
    return events[0] ?? null
  }

  private eventEnd(event: ActivityEvent): number {
    return new Date(event.timestamp).getTime() + event.duration * 1000
  }

  private async waitForServerDown(): Promise<void> {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${API}/info`, { signal: AbortSignal.timeout(350) })
        if (!response.ok) return
      } catch {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  private async waitForFreshData(): Promise<void> {
    if (!this.tracking) return
    const deadline = Date.now() + 15_000
    let last = '等待采集桶更新'
    while (Date.now() < deadline) {
      const health = await this.dataHealth(true)
      if (health.ok) return
      last = health.detail
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`受控重启后仍无新事件：${last}`)
  }

  private describeRecovery(action: RecoveryAction, retryAfterMs: number, detail: string): HealthResult {
    if (action === 'healthy') return { ok: true, detail: '采集链路健康' }
    if (action === 'wait') return { ok: false, detail: `检测到异常，等待连续确认：${detail}` }
    if (action === 'external') return { ok: false, detail: `外部 ActivityWatch 异常，不自动结束其进程：${detail}` }
    if (action === 'blocked-disk') return { ok: false, detail: '磁盘空间已到临界值，禁止重启风暴' }
    if (action === 'cooldown') return { ok: false, detail: `恢复退避中，约 ${Math.ceil(retryAfterMs / 1000)} 秒后可重试` }
    return { ok: false, detail: '达到恢复阈值，正在受控重启采集器' }
  }
}
