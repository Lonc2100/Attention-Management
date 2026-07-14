import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  it('migrates v1 data and stores only sparse Codex context transitions', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'migration-v2.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, JSON.stringify({
      version: 1,
      settings: { morningReminder: '08:45' },
      records: {
        '2026-07-14': {
          date: '2026-07-14',
          outcomes: [{ id: 'one', title: '保留旧计划' }],
          priorityOutcomeId: 'one',
          planCompletedAt: null,
          review: null,
          afkNotes: [],
          aiAnalysis: null
        }
      }
    }), 'utf8')

    const store = new AppStore(file)
    expect(store.getRecord('2026-07-14').outcomes[0].title).toBe('保留旧计划')
    expect(store.getSettings().morningReminder).toBe('08:45')
    expect(store.getCodexContextSamples('2026-07-14')).toEqual([])
    const migratedImmediately = JSON.parse(readFileSync(file, 'utf8')) as { version: number; codexContextSamples?: unknown; projectAliases?: unknown }
    expect(migratedImmediately.version).toBe(2)
    expect(migratedImmediately.codexContextSamples).toEqual({})
    expect(migratedImmediately.projectAliases).toEqual({})

    const first = {
      detectedAt: Date.parse('2026-07-14T01:00:00.000Z'),
      threadId: 'thread-one',
      threadName: '时间效率助手',
      cwd: 'D:\\codex work\\Attention-Management',
      recencyAt: Date.parse('2026-07-14T00:59:59.000Z'),
      source: 'vscode' as const,
      projectKey: 'cwd:d:\\codex work\\attention-management',
      projectLabel: 'Attention-Management',
      identitySource: 'folder' as const
    }
    store.addCodexContextSample('2026-07-14', first)
    store.addCodexContextSample('2026-07-14', { ...first, detectedAt: first.detectedAt + 5_000 })
    store.addCodexContextSample('2026-07-14', { ...first, detectedAt: first.detectedAt + 10_000, threadId: 'thread-two' })
    store.setProjectAlias('cwd:d:\\codex work\\attention-management', '时间效率助手')

    expect(store.getCodexContextSamples('2026-07-14')).toHaveLength(2)
    expect(store.getProjectAliases()).toEqual({ 'cwd:d:\\codex work\\attention-management': '时间效率助手' })

    const persisted = JSON.parse(readFileSync(file, 'utf8')) as { version: number }
    expect(persisted.version).toBe(2)
  })
})
