import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CodexContextSample, DailyRecord, Settings } from '../shared/contracts'
import { emptyRecord } from './date'

type PersistedDataV3 = {
  version: 3
  settings: Settings
  records: Record<string, DailyRecord>
  codexContextSamples: Record<string, CodexContextSample[]>
  projectAliases: Record<string, string>
}
type PersistedDataInput = {
  version?: number
  settings?: Partial<Settings>
  records?: Record<string, DailyRecord>
  codexContextSamples?: Record<string, CodexContextSample[]>
  projectAliases?: Record<string, string>
}

const MAX_CONTEXT_SAMPLES_PER_DAY = 5_000
const MAX_CONTEXT_DAYS = 120

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
  private data: PersistedDataV3
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

  private load(): PersistedDataV3 {
    try {
      if (existsSync(this.filePath)) {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as PersistedDataInput
        this.migrationRequired = parsed.version !== 3
        return {
          version: 3,
          settings: { ...defaultSettings, ...parsed.settings, aiProvider: 'codex-cli' },
          records: parsed.records ?? {},
          codexContextSamples: parsed.codexContextSamples ?? {},
          projectAliases: parsed.projectAliases ?? {}
        }
      }
    } catch (error) {
      console.error('Failed to load app data:', error)
    }
    return {
      version: 3,
      settings: { ...defaultSettings },
      records: {},
      codexContextSamples: {},
      projectAliases: {}
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
