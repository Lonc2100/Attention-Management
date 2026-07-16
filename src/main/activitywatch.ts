import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type {
  ActivityEvent,
  ActivityDetails,
  ActivityOverride,
  ActivityRule,
  ActivitySummary,
  AfkNote,
  CodexContextSample,
  CodexContextStatus,
  PrivacyRule
} from '../shared/contracts'
import type { DailyWorkActivity } from '../shared/work-activity'
import { aggregateActivity, disconnectedSummary } from './aggregate'
import { classifyActivityDay } from './classification'
import { dayBounds } from './date'
import { identityForSample } from './project-attribution'

interface Bucket {
  id: string
  type: string
  hostname?: string
  client?: string
  last_updated?: string
}

interface ManagedProcess {
  name: string
  process: ChildProcessWithoutNullStreams
}

export interface CurrentActivityState {
  app: string
  title: string
  isAfk: boolean
  fresh?: boolean
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
  private tracking = true

  constructor(private readonly runtimeRoot: string) {}

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
      this.startProcess('server', server)
      await waitForServer()
    }

    if (tracking) this.startWatchers()
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
    privacyRules: PrivacyRule[] = []
  ): Promise<ActivitySummary> {
    try {
      await waitForServer(1500)
      const buckets = await this.getBuckets()
      const windowBucket = this.newestBucket(buckets, 'currentwindow')
      const afkBucket = this.newestBucket(buckets, 'afkstatus')
      const [windowEvents, afkEvents] = await Promise.all([
        windowBucket ? this.getEvents(windowBucket.id, date) : Promise.resolve([]),
        afkBucket ? this.getEvents(afkBucket.id, date) : Promise.resolve([])
      ])
      return aggregateActivity(
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
        privacyRules
      )
    } catch (error) {
      return disconnectedSummary(this.tracking, error)
    }
  }

  async getDailyActiveDurations(dates: string[]): Promise<DailyWorkActivity[]> {
    if (dates.length === 0) return []
    await waitForServer(1500)
    const buckets = await this.getBuckets()
    const windowBucket = this.newestBucket(buckets, 'currentwindow')
    const afkBucket = this.newestBucket(buckets, 'afkstatus')
    if (!windowBucket || !afkBucket) throw new Error('ActivityWatch 窗口或 AFK 数据源不可用')

    const query = [
      `events = flood(query_bucket(${JSON.stringify(windowBucket.id)}));`,
      'observed_seconds = sum_durations(events);',
      `not_afk = flood(query_bucket(${JSON.stringify(afkBucket.id)}));`,
      'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
      'active_events = filter_period_intersect(events, not_afk);',
      'RETURN = {"activeSeconds": sum_durations(active_events), "observedSeconds": observed_seconds};'
    ]
    const timeperiods = dates.map((date) => {
      const { start, end } = dayBounds(date)
      return `${start}/${end}`
    })
    const response = await fetch(`${API}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, timeperiods }),
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`读取 ActivityWatch 区间统计失败：HTTP ${response.status}`)
    const values = await response.json() as Array<{ activeSeconds?: unknown; observedSeconds?: unknown }>
    if (!Array.isArray(values) || values.length !== dates.length) throw new Error('ActivityWatch 区间统计返回数量异常')
    return dates.map((date, index) => {
      const activeSeconds = Number(values[index]?.activeSeconds)
      const observedSeconds = Number(values[index]?.observedSeconds)
      if (!Number.isFinite(activeSeconds) || !Number.isFinite(observedSeconds)) {
        throw new Error(`ActivityWatch 区间统计格式异常：${date}`)
      }
      return {
        date,
        activeSeconds: Math.max(0, activeSeconds),
        observedSeconds: Math.max(0, observedSeconds),
        available: true
      }
    })
  }

  async getDetails(
    date: string,
    contextSamples: CodexContextSample[] = [],
    projectAliases: Record<string, string> = {},
    rules: ActivityRule[] = [],
    overrides: ActivityOverride[] = [],
    manualProjects: Record<string, string> = {},
    privacyRules: PrivacyRule[] = []
  ): Promise<ActivityDetails> {
    try {
      await waitForServer(1500)
      const buckets = await this.getBuckets()
      const windowBucket = this.newestBucket(buckets, 'currentwindow')
      const afkBucket = this.newestBucket(buckets, 'afkstatus')
      const [windowEvents, afkEvents] = await Promise.all([
        windowBucket ? this.getEvents(windowBucket.id, date) : Promise.resolve([]),
        afkBucket ? this.getEvents(afkBucket.id, date) : Promise.resolve([])
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
      return { ok: true, detail: `v${info.version ?? 'unknown'} · ${info.hostname ?? 'localhost'}` }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }

  async bucketHealth(type: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const bucket = this.newestBucket(await this.getBuckets(), type)
      return bucket ? { ok: true, detail: bucket.id } : { ok: false, detail: `没有 ${type} 采集桶` }
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
      fresh: true
    }
  }

  stopAll(): void {
    this.stopOwned(this.owned.map((item) => item.name))
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
    const child = spawn(executable, [], {
      cwd: dirname(executable),
      windowsHide: true,
      stdio: 'pipe'
    })
    child.stderr.on('data', (chunk) => console.error(`[ActivityWatch:${name}]`, chunk.toString()))
    child.on('exit', () => {
      this.owned = this.owned.filter((item) => item.process !== child)
    })
    this.owned.push({ name, process: child })
    console.log(`Started ActivityWatch ${name}: ${basename(executable)}`)
  }

  private stopOwned(names: string[]): void {
    const set = new Set(names)
    for (const item of this.owned.filter((candidate) => set.has(candidate.name))) {
      item.process.kill()
    }
    this.owned = this.owned.filter((item) => !set.has(item.name))
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
      .sort((a, b) => (b.last_updated ?? '').localeCompare(a.last_updated ?? ''))[0]
  }

  private async getEvents(bucketId: string, date: string): Promise<ActivityEvent[]> {
    const { start, end } = dayBounds(date)
    const params = new URLSearchParams({ start, end, limit: '-1' })
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
}
