import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ActivityOverride, ActivityRule, CodexContextSample, DailyRecord, Outcome, ProjectOption, Settings } from '../shared/contracts'
import { emptyRecord } from './date'

type PersistedDataV5 = {
  version: 5
  settings: Settings
  records: Record<string, DailyRecord>
  codexContextSamples: Record<string, CodexContextSample[]>
  projectAliases: Record<string, string>
  classificationRules: ActivityRule[]
  activityOverrides: Record<string, ActivityOverride[]>
  manualProjects: Record<string, string>
}
type PersistedDataInput = {
  version?: number
  settings?: Partial<Settings>
  records?: Record<string, DailyRecord>
  codexContextSamples?: Record<string, CodexContextSample[]>
  projectAliases?: Record<string, string>
  classificationRules?: ActivityRule[]
  activityOverrides?: Record<string, ActivityOverride[]>
  manualProjects?: Record<string, string>
}

const MAX_CONTEXT_SAMPLES_PER_DAY = 5_000
const MAX_CONTEXT_DAYS = 120

function normalizeOutcome(outcome: Outcome): Outcome {
  const projectKeys = Array.isArray(outcome.projectKeys)
    ? [...new Set(outcome.projectKeys.filter((key): key is string => typeof key === 'string').map((key) => key.trim()).filter(Boolean))]
    : []
  return { ...outcome, projectKeys }
}

function normalizeRecord(record: DailyRecord): DailyRecord {
  return { ...record, outcomes: Array.isArray(record.outcomes) ? record.outcomes.map(normalizeOutcome) : [] }
}

export const defaultSettings: Settings = {
  launchAtLogin: true,
  trackingEnabled: true,
  morningReminder: '09:30',
  eveningReminder: '21:30',
  aiProvider: 'codex-cli',
  widgetMode: 'always-on-top',
  widgetExpanded: false,
  widgetPosition: null
}

export class AppStore {
  private data: PersistedDataV5
  private migrationRequired = false

  constructor(private readonly filePath: string) {
    this.data = this.load()
    if (this.migrationRequired) this.save()
  }

  get path(): string {
    return this.filePath
  }

  getSettings(): Settings {
    return { ...this.data.settings }
  }

  updateSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch, aiProvider: 'codex-cli' }
    this.save()
    return this.getSettings()
  }

  getRecord(date: string): DailyRecord {
    const existing = this.data.records[date]
    if (!existing) {
      this.data.records[date] = emptyRecord(date)
      this.save()
    }
    return structuredClone(this.data.records[date] ?? emptyRecord(date))
  }

  getRecordSnapshot(date: string): DailyRecord {
    return structuredClone(this.data.records[date] ?? emptyRecord(date))
  }

  updateRecord(date: string, updater: (record: DailyRecord) => DailyRecord): DailyRecord {
    const current = this.getRecord(date)
    const next = updater(current)
    this.data.records[date] = next
    this.save()
    return structuredClone(next)
  }

  getCodexContextSamples(date: string): CodexContextSample[] {
    return structuredClone(this.data.codexContextSamples[date] ?? [])
  }

  addCodexContextSample(date: string, sample: CodexContextSample): boolean {
    const samples = this.data.codexContextSamples[date] ?? []
    const last = samples[samples.length - 1]
    if (last && last.threadId === sample.threadId && last.recencyAt === sample.recencyAt) return false
    this.data.codexContextSamples[date] = [...samples, sample]
      .sort((a, b) => a.detectedAt - b.detectedAt)
      .slice(-MAX_CONTEXT_SAMPLES_PER_DAY)
    this.pruneContextDays()
    this.save()
    return true
  }

  getProjectAliases(): Record<string, string> {
    return { ...this.data.projectAliases }
  }

  setProjectAlias(projectKey: string, label: string): Record<string, string> {
    const key = projectKey.trim()
    const value = label.trim().slice(0, 60)
    if (!key || key === 'unclassified') throw new Error('这个项目不能重命名')
    if (value) this.data.projectAliases[key] = value
    else delete this.data.projectAliases[key]
    this.save()
    return this.getProjectAliases()
  }

  getClassificationRules(): ActivityRule[] {
    return structuredClone(this.data.classificationRules)
  }

  addClassificationRule(rule: ActivityRule): ActivityRule[] {
    if (this.data.classificationRules.some((item) => item.id === rule.id)) throw new Error('归类规则 ID 已存在')
    this.data.classificationRules.push(structuredClone(rule))
    this.save()
    return this.getClassificationRules()
  }

  setClassificationRuleEnabled(ruleId: string, enabled: boolean): ActivityRule[] {
    const rule = this.data.classificationRules.find((item) => item.id === ruleId)
    if (!rule) throw new Error('归类规则不存在')
    rule.enabled = enabled
    this.save()
    return this.getClassificationRules()
  }

  moveClassificationRule(ruleId: string, direction: 'up' | 'down'): ActivityRule[] {
    const index = this.data.classificationRules.findIndex((item) => item.id === ruleId)
    if (index < 0) throw new Error('归类规则不存在')
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= this.data.classificationRules.length) return this.getClassificationRules()
    const current = this.data.classificationRules[index]
    const next = this.data.classificationRules[nextIndex]
    if (!current || !next) return this.getClassificationRules()
    this.data.classificationRules[index] = next
    this.data.classificationRules[nextIndex] = current
    this.save()
    return this.getClassificationRules()
  }

  removeClassificationRule(ruleId: string): ActivityRule[] {
    this.data.classificationRules = this.data.classificationRules.filter((item) => item.id !== ruleId)
    this.save()
    return this.getClassificationRules()
  }

  getActivityOverrides(date: string): ActivityOverride[] {
    return structuredClone(this.data.activityOverrides[date] ?? [])
  }

  addActivityOverride(override: ActivityOverride): ActivityOverride[] {
    const current = this.data.activityOverrides[override.date] ?? []
    this.data.activityOverrides[override.date] = [...current.filter((item) => item.id !== override.id), structuredClone(override)]
      .sort((a, b) => a.start.localeCompare(b.start))
    this.save()
    return this.getActivityOverrides(override.date)
  }

  removeActivityOverride(date: string, overrideId: string): ActivityOverride[] {
    this.data.activityOverrides[date] = (this.data.activityOverrides[date] ?? []).filter((item) => item.id !== overrideId)
    if (!this.data.activityOverrides[date]?.length) delete this.data.activityOverrides[date]
    this.save()
    return this.getActivityOverrides(date)
  }

  getManualProjects(): Record<string, string> {
    return { ...this.data.manualProjects }
  }

  getKnownProjectOptions(): ProjectOption[] {
    const latest = new Map<string, ProjectOption & { detectedAt: number }>()
    for (const samples of Object.values(this.data.codexContextSamples)) {
      for (const sample of samples) {
        const existing = latest.get(sample.projectKey)
        if (existing && existing.detectedAt > sample.detectedAt) continue
        const alias = this.data.projectAliases[sample.projectKey]?.trim()
        latest.set(sample.projectKey, {
          key: sample.projectKey,
          label: alias || sample.projectLabel,
          source: alias ? 'alias' : sample.identitySource,
          detectedAt: sample.detectedAt
        })
      }
    }
    for (const [key, label] of Object.entries(this.data.projectAliases)) {
      if (!latest.has(key) && label.trim()) latest.set(key, { key, label: label.trim(), source: 'alias', detectedAt: 0 })
    }
    for (const [key, label] of Object.entries(this.data.manualProjects)) {
      latest.set(key, { key, label, source: 'manual', detectedAt: Number.MAX_SAFE_INTEGER })
    }
    return [...latest.values()]
      .map(({ detectedAt: _detectedAt, ...project }) => project)
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }

  setManualProject(projectKey: string, label: string): Record<string, string> {
    const key = projectKey.trim()
    const value = label.trim().slice(0, 60)
    if (!key.startsWith('manual:') || !value) throw new Error('自定义项目名称无效')
    this.data.manualProjects[key] = value
    this.save()
    return this.getManualProjects()
  }

  private load(): PersistedDataV5 {
    try {
      if (existsSync(this.filePath)) {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as PersistedDataInput
        this.migrationRequired = parsed.version !== 5
        return {
          version: 5,
          settings: { ...defaultSettings, ...parsed.settings, aiProvider: 'codex-cli' },
          records: Object.fromEntries(Object.entries(parsed.records ?? {}).map(([date, record]) => [date, normalizeRecord(record)])),
          codexContextSamples: parsed.codexContextSamples ?? {},
          projectAliases: parsed.projectAliases ?? {},
          classificationRules: parsed.classificationRules ?? [],
          activityOverrides: parsed.activityOverrides ?? {},
          manualProjects: parsed.manualProjects ?? {}
        }
      }
    } catch (error) {
      console.error('Failed to load app data:', error)
    }
    return {
      version: 5,
      settings: { ...defaultSettings },
      records: {},
      codexContextSamples: {},
      projectAliases: {},
      classificationRules: [],
      activityOverrides: {},
      manualProjects: {}
    }
  }

  private pruneContextDays(): void {
    const dates = Object.keys(this.data.codexContextSamples).sort().reverse()
    for (const date of dates.slice(MAX_CONTEXT_DAYS)) delete this.data.codexContextSamples[date]
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }
}
