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
      outcomes: [{ id: 'one', title: '交付真实链路', projectKeys: [] }],
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
    expect(migratedImmediately.version).toBe(8)
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
    expect(store.getKnownProjectOptions()).toEqual([
      expect.objectContaining({ key: 'cwd:d:\\codex work\\attention-management', label: '时间效率助手', source: 'alias' })
    ])

    const persisted = JSON.parse(readFileSync(file, 'utf8')) as { version: number }
    expect(persisted.version).toBe(8)
  })

  it('migrates v2 settings with safe floating-widget defaults and persists placement', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'migration-v3.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, JSON.stringify({
      version: 2,
      settings: { launchAtLogin: false, trackingEnabled: true, morningReminder: '10:00', eveningReminder: '22:00', aiProvider: 'codex-cli' },
      records: {},
      codexContextSamples: {},
      projectAliases: {}
    }), 'utf8')

    const store = new AppStore(file)
    expect(store.getSettings()).toMatchObject({
      launchAtLogin: false,
      widgetMode: 'always-on-top',
      widgetExpanded: false,
      widgetPosition: null,
      idleThresholdMinutes: 5
    })
    store.updateSettings({ widgetExpanded: true, widgetPosition: { x: 1200, y: 24, displayId: 'display-2' } })
    expect(new AppStore(file).getSettings()).toMatchObject({
      widgetExpanded: true,
      widgetPosition: { x: 1200, y: 24, displayId: 'display-2' },
      idleThresholdMinutes: 5
    })
  })

  it('persists a validated idle threshold and reversible idle corrections', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'idle-v8.json')
    writeFileSync(file, JSON.stringify({ version: 7, settings: {}, records: {} }), 'utf8')
    const store = new AppStore(file)
    expect(store.getSettings().idleThresholdMinutes).toBe(5)
    expect(store.updateSettings({ idleThresholdMinutes: 20 }).idleThresholdMinutes).toBe(20)
    expect(store.updateSettings({ idleThresholdMinutes: 999 }).idleThresholdMinutes).toBe(5)
    const existingFile = join(directory, 'idle-v8-existing-choice.json')
    writeFileSync(existingFile, JSON.stringify({ version: 8, settings: { idleThresholdMinutes: 15 }, records: {} }), 'utf8')
    expect(new AppStore(existingFile).getSettings().idleThresholdMinutes).toBe(15)
    store.addIdleOverride({
      id: 'idle-one', date: '2026-07-19', start: '2026-07-19T03:00:00.000Z',
      end: '2026-07-19T03:20:00.000Z', createdAt: 1000
    })
    expect(new AppStore(file).getIdleOverrides('2026-07-19')).toEqual([expect.objectContaining({ id: 'idle-one' })])
    store.removeIdleOverride('2026-07-19', 'idle-one')
    expect(store.getIdleOverrides('2026-07-19')).toEqual([])
  })

  it('migrates v3 classification data safely and persists reversible corrections and ordered rules', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'migration-v4.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, JSON.stringify({
      version: 3,
      settings: {},
      records: {},
      codexContextSamples: {},
      projectAliases: { 'cwd:attention': '时间效率助手' }
    }), 'utf8')

    const store = new AppStore(file)
    expect(store.getClassificationRules()).toEqual([])
    expect(store.getActivityOverrides('2026-07-15')).toEqual([])
    expect(store.getManualProjects()).toEqual({})

    store.setManualProject('manual:media', '自媒体创作')
    store.addClassificationRule({
      id: 'rule-one',
      projectKey: 'manual:media',
      app: 'chrome.exe',
      titleMatch: 'contains',
      titlePattern: '小红书',
      enabled: true,
      createdAt: 1000,
      appliesFrom: 1000
    })
    store.addClassificationRule({
      id: 'rule-two',
      projectKey: 'cwd:attention',
      app: 'chrome.exe',
      titleMatch: 'contains',
      titlePattern: 'ActivityWatch',
      enabled: true,
      createdAt: 2000,
      appliesFrom: 2000
    })
    store.moveClassificationRule('rule-two', 'up')
    store.addActivityOverride({
      id: 'override-one',
      date: '2026-07-15',
      start: '2026-07-15T01:00:00.000Z',
      end: '2026-07-15T01:10:00.000Z',
      app: 'chrome.exe',
      title: '研究 ActivityWatch',
      projectKey: 'cwd:attention',
      createdAt: 3000
    })

    const reloaded = new AppStore(file)
    expect(reloaded.getClassificationRules().map((rule) => rule.id)).toEqual(['rule-two', 'rule-one'])
    expect(reloaded.getActivityOverrides('2026-07-15')).toHaveLength(1)
    expect(reloaded.getManualProjects()).toEqual({ 'manual:media': '自媒体创作' })
    expect((JSON.parse(readFileSync(file, 'utf8')) as { version: number }).version).toBe(8)

    reloaded.removeActivityOverride('2026-07-15', 'override-one')
    reloaded.setClassificationRuleEnabled('rule-two', false)
    reloaded.removeClassificationRule('rule-one')
    expect(reloaded.getActivityOverrides('2026-07-15')).toEqual([])
    expect(reloaded.getClassificationRules()).toEqual([expect.objectContaining({ id: 'rule-two', enabled: false })])
  })

  it('migrates v4 outcomes to project links without losing existing records or classification data', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'migration-v5.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, JSON.stringify({
      version: 4,
      settings: { morningReminder: '08:30' },
      records: {
        '2026-07-15': {
          date: '2026-07-15',
          outcomes: [{ id: 'priority', title: '交付成果闭环' }],
          priorityOutcomeId: 'priority',
          planCompletedAt: '2026-07-15T00:30:00.000Z',
          review: null,
          afkNotes: [],
          aiAnalysis: null
        }
      },
      codexContextSamples: {},
      projectAliases: { 'cwd:attention': '时间效率助手' },
      classificationRules: [{
        id: 'rule-one', projectKey: 'cwd:attention', app: 'chrome.exe', titleMatch: 'contains',
        titlePattern: 'ActivityWatch', enabled: true, createdAt: 1000, appliesFrom: 1000
      }],
      activityOverrides: {},
      manualProjects: {}
    }), 'utf8')

    const store = new AppStore(file)
    expect(store.getRecord('2026-07-15')).toMatchObject({
      outcomes: [{ id: 'priority', title: '交付成果闭环', projectKeys: [] }],
      priorityOutcomeId: 'priority'
    })
    expect(store.getClassificationRules()).toHaveLength(1)
    expect(store.getProjectAliases()).toEqual({ 'cwd:attention': '时间效率助手' })
    expect((JSON.parse(readFileSync(file, 'utf8')) as { version: number }).version).toBe(8)
  })

  it('creates a recovery checkpoint before replacing local data from a backup', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'restore-v6.json')
    const recovery = join(directory, 'restore-v6.recovery.json')
    writeFileSync(file, JSON.stringify({ version: 6, settings: { morningReminder: '09:30' }, records: { '2026-07-15': { date: '2026-07-15', outcomes: [], priorityOutcomeId: null, planCompletedAt: null, review: null, afkNotes: [], aiAnalysis: null } } }), 'utf8')
    const store = new AppStore(file)
    store.restoreData({ version: 6, settings: { eveningReminder: '20:30' }, records: {}, codexContextSamples: {}, projectAliases: {}, classificationRules: [], activityOverrides: {}, manualProjects: {}, privacyRules: [] }, recovery)
    expect(JSON.parse(readFileSync(recovery, 'utf8'))).toMatchObject({ records: { '2026-07-15': expect.any(Object) } })
    expect(store.getSettings().eveningReminder).toBe('20:30')
    expect(store.exportData().version).toBe(8)
  })

  it('persists reversible workday boundaries and the last confirmed workday', () => {
    const directory = join(process.cwd(), 'tests', '.data')
    const file = join(directory, 'workday-v7.json')
    writeFileSync(file, JSON.stringify({ version: 6, settings: {}, records: {} }), 'utf8')
    const store = new AppStore(file)
    store.setWorkdayBoundary('2026-07-19', '2026-07-19T02:00:00.000Z')
    store.setLastResolvedWorkdayKey('2026-07-19')

    const reloaded = new AppStore(file)
    expect(reloaded.getWorkdayBoundaryOverrides()).toEqual({ '2026-07-19': '2026-07-19T02:00:00.000Z' })
    expect(reloaded.getLastResolvedWorkdayKey()).toBe('2026-07-19')
    reloaded.removeWorkdayBoundary('2026-07-19')
    expect(reloaded.getWorkdayBoundaryOverrides()).toEqual({})
  })
})
