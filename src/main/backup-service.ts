/**
 * Local, explicit backup helpers.  They deliberately do not know about
 * ActivityWatch buckets: raw ActivityWatch data remains owned/exported by
 * ActivityWatch itself.  The CSV is intentionally a small, shareable report
 * rather than a second copy of window-title history.
 */
export const BACKUP_FORMAT = 'time-efficiency-backup' as const
export const BACKUP_SCHEMA_VERSION = 1 as const

export interface BackupEnvelope<T = unknown> {
  format: typeof BACKUP_FORMAT
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  createdAt: string
  appData: T
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function csvCell(value: unknown): string {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ')
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Creates a self-contained backup of this application's local state only. */
export function createBackupEnvelope<T>(appData: T, now = new Date()): BackupEnvelope<T> {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    appData: structuredClone(appData)
  }
}

/** Reject malformed or future backup formats before any restore can begin. */
export function parseBackupEnvelope(input: string): BackupEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('备份文件格式无效')
  }
  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT || parsed.schemaVersion !== BACKUP_SCHEMA_VERSION
    || typeof parsed.createdAt !== 'string' || !isObject(parsed.appData)) {
    throw new Error('备份文件格式无效')
  }
  return parsed as unknown as BackupEnvelope
}

/**
 * Export a deliberately aggregated report.  Never include window titles,
 * Codex thread IDs, paths, project keys, AI text, or ActivityWatch raw events.
 */
export function buildAggregatedCsv(input: unknown): string {
  const data = isObject(input) ? input : {}
  const records = isObject(data.records) ? data.records : {}
  const rows = ['日期,重要成果,成果状态,主观效率,复盘摘要,明日意图']
  for (const [date, raw] of Object.entries(records).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isObject(raw)) continue
    const outcomes = Array.isArray(raw.outcomes) ? raw.outcomes : []
    const names = outcomes.flatMap((outcome) => isObject(outcome) && typeof outcome.title === 'string' ? [outcome.title] : [])
    const review = isObject(raw.review) ? raw.review : {}
    const statuses = isObject(review.outcomeStatuses) ? review.outcomeStatuses : {}
    const statusText = outcomes.flatMap((outcome) => {
      if (!isObject(outcome) || typeof outcome.id !== 'string' || typeof outcome.title !== 'string') return []
      const status = typeof statuses[outcome.id] === 'string' ? statuses[outcome.id] : 'pending'
      return [`${outcome.title}:${status}`]
    })
    rows.push([
      date,
      names.join(' / '),
      statusText.join(' / '),
      typeof review.subjectiveScore === 'number' ? review.subjectiveScore : '',
      typeof review.summary === 'string' ? review.summary : '',
      typeof review.tomorrowIntent === 'string' ? review.tomorrowIntent : ''
    ].map(csvCell).join(','))
  }
  return `${rows.join('\n')}\n`
}
