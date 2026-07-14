import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppStore } from '../src/main/store'

describe('local persistence', () => {
  it('keeps the morning plan after recreating the store', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'persistence.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, JSON.stringify({ version: 1, settings: {}, records: {} }), 'utf8')
    const first = new AppStore(file)
    first.updateRecord('2026-07-14', (record) => ({
      ...record,
      outcomes: [{ id: 'one', title: '交付真实链路' }],
      priorityOutcomeId: 'one',
      planCompletedAt: '2026-07-14T01:00:00.000Z'
    }))
    const reloaded = new AppStore(file).getRecord('2026-07-14')
    expect(reloaded.outcomes[0].title).toBe('交付真实链路')
    expect(reloaded.priorityOutcomeId).toBe('one')
    expect(reloaded.planCompletedAt).toBeTruthy()
  })
})
