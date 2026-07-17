import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DailyWorkActivity } from '../shared/work-activity'

interface PersistedFacts {
  version: 1
  facts: Record<string, DailyWorkActivity>
}

function validFact(value: unknown): value is DailyWorkActivity {
  if (!value || typeof value !== 'object') return false
  const fact = value as Partial<DailyWorkActivity>
  return typeof fact.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(fact.date)
    && typeof fact.activeSeconds === 'number'
    && Number.isFinite(fact.activeSeconds)
    && fact.activeSeconds >= 0
    && typeof fact.observedSeconds === 'number'
    && Number.isFinite(fact.observedSeconds)
    && fact.observedSeconds >= 0
    && fact.available === true
}

export class WorkActivityFactsCache {
  private loaded = false
  private readonly facts = new Map<string, DailyWorkActivity>()

  constructor(private readonly filePath: string) {}

  async resolve(
    dates: string[],
    today: string,
    load: (dates: string[]) => Promise<DailyWorkActivity[]>
  ): Promise<DailyWorkActivity[]> {
    this.loadOnce()
    const missing = dates.filter((date) => date === today || !this.facts.has(date))
    if (missing.length > 0) {
      const loaded = await load(missing)
      for (const fact of loaded) {
        if (fact.available && missing.includes(fact.date)) this.facts.set(fact.date, fact)
      }
      this.persist()
    }
    return dates.map((date) => this.facts.get(date) ?? {
      date,
      activeSeconds: 0,
      observedSeconds: 0,
      available: false
    })
  }

  private loadOnce(): void {
    if (this.loaded) return
    this.loaded = true
    if (!existsSync(this.filePath)) return
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<PersistedFacts>
      if (parsed.version !== 1 || !parsed.facts || typeof parsed.facts !== 'object') return
      for (const [date, fact] of Object.entries(parsed.facts)) {
        if (validFact(fact) && fact.date === date) this.facts.set(date, fact)
      }
    } catch {
      // This cache is derived from ActivityWatch and can always be rebuilt.
    }
  }

  private persist(): void {
    const payload: PersistedFacts = {
      version: 1,
      facts: Object.fromEntries(this.facts)
    }
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(temporary, JSON.stringify(payload), 'utf8')
    renameSync(temporary, this.filePath)
  }
}
