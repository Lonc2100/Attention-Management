import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { DailyRecord, Settings } from '../shared/contracts'
import { emptyRecord } from './date'

interface PersistedData {
  version: 1
  settings: Settings
  records: Record<string, DailyRecord>
}

export const defaultSettings: Settings = {
  launchAtLogin: true,
  trackingEnabled: true,
  morningReminder: '09:30',
  eveningReminder: '21:30',
  aiProvider: 'codex-cli'
}

export class AppStore {
  private data: PersistedData

  constructor(private readonly filePath: string) {
    this.data = this.load()
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
    if (!this.data.records[date]) {
      this.data.records[date] = emptyRecord(date)
      this.save()
    }
    return structuredClone(this.data.records[date])
  }

  updateRecord(date: string, updater: (record: DailyRecord) => DailyRecord): DailyRecord {
    const current = this.getRecord(date)
    const next = updater(current)
    this.data.records[date] = next
    this.save()
    return structuredClone(next)
  }

  private load(): PersistedData {
    try {
      if (existsSync(this.filePath)) {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<PersistedData>
        return {
          version: 1,
          settings: { ...defaultSettings, ...parsed.settings, aiProvider: 'codex-cli' },
          records: parsed.records ?? {}
        }
      }
    } catch (error) {
      console.error('Failed to load app data:', error)
    }
    return { version: 1, settings: defaultSettings, records: {} }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }
}
