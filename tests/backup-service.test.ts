import { describe, expect, it } from 'vitest'
import { buildAggregatedCsv, createBackupEnvelope, parseBackupEnvelope } from '../src/main/backup-service'

const data = {
  version: 6,
  settings: { launchAtLogin: true, privacyRules: [], onboardingCompletedAt: null },
  records: {
    '2026-07-15': {
      date: '2026-07-15', outcomes: [{ id: 'priority', title: '交付', projectKeys: ['cwd:private'] }], priorityOutcomeId: 'priority', planCompletedAt: null,
      review: null, afkNotes: [], aiAnalysis: '不应导出'
    }
  },
  codexContextSamples: { '2026-07-15': [{ threadId: 'secret-thread', cwd: 'D:\\secret', projectKey: 'cwd:private', threadName: '绝密标题' }] },
  projectAliases: {}, classificationRules: [], activityOverrides: {}, manualProjects: {}
}

describe('backup service', () => {
  it('wraps app data in a versioned local-only envelope and rejects malformed input', () => {
    const envelope = createBackupEnvelope(data, new Date('2026-07-15T12:00:00.000Z'))
    expect(envelope.format).toBe('time-efficiency-backup')
    expect(parseBackupEnvelope(JSON.stringify(envelope))).toEqual(envelope)
    expect(() => parseBackupEnvelope('{"format":"wrong"}')).toThrow('备份文件格式无效')
  })

  it('exports aggregated CSV without raw titles, paths, keys, threads, or AI text', () => {
    const csv = buildAggregatedCsv(data)
    expect(csv).toContain('日期,重要成果')
    expect(csv).toContain('2026-07-15')
    expect(csv).not.toContain('绝密标题')
    expect(csv).not.toContain('D:\\secret')
    expect(csv).not.toContain('cwd:private')
    expect(csv).not.toContain('secret-thread')
    expect(csv).not.toContain('不应导出')
  })
})
