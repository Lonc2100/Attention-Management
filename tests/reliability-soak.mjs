import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const artifacts = join(root, 'tests', '.artifacts')
const durationMs = Number(process.env.RELIABILITY_SOAK_MS ?? 15 * 60_000)
const sampleIntervalMs = Number(process.env.RELIABILITY_SAMPLE_MS ?? 5_000)
const queryIntervalMs = Number(process.env.RELIABILITY_QUERY_MS ?? 15_000)
const api = 'http://127.0.0.1:5600/api/0'

mkdirSync(artifacts, { recursive: true })

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayPeriod(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const start = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
  const end = new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
  return `${start}/${end}`
}

function recentPeriods(count) {
  const result = []
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(cursor)
    date.setDate(date.getDate() - offset)
    result.push(dayPeriod(localDateKey(date)))
  }
  return result
}

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5_000) })
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`)
  return response.json()
}

function newestBucket(buckets, type) {
  return Object.values(buckets)
    .filter((bucket) => bucket.type === type)
    .sort((left, right) => updatedAt(right) - updatedAt(left))[0]
}

function updatedAt(bucket) {
  for (const value of [bucket?.metadata?.end, bucket?.last_updated, bucket?.created]) {
    const parsed = Date.parse(value ?? '')
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.NEGATIVE_INFINITY
}

const startedAt = Date.now()
let nextQueryAt = 0
let samples = 0
let queries = 0
let maxBucketAgeMs = 0
let version = 'unknown'

while (Date.now() - startedAt < durationMs) {
  const info = await json(`${api}/info`)
  version = info.version ?? version
  const buckets = await json(`${api}/buckets/`)
  const windowBucket = newestBucket(buckets, 'currentwindow')
  const afkBucket = newestBucket(buckets, 'afkstatus')
  assert.ok(windowBucket, 'currentwindow bucket disappeared during soak')
  assert.ok(afkBucket, 'afkstatus bucket disappeared during soak')
  const windowAgeMs = Date.now() - updatedAt(windowBucket)
  const afkAgeMs = Date.now() - updatedAt(afkBucket)
  maxBucketAgeMs = Math.max(maxBucketAgeMs, windowAgeMs, afkAgeMs)
  assert.ok(windowAgeMs <= 120_000, `window bucket became stale (${Math.round(windowAgeMs / 1000)}s)`)
  assert.ok(afkAgeMs <= 300_000, `AFK bucket exceeded its normal transition gap (${Math.round(afkAgeMs / 1000)}s)`)

  if (Date.now() >= nextQueryAt) {
    const query = [
      `events = flood(query_bucket(${JSON.stringify(windowBucket.id)}));`,
      'observed_seconds = sum_durations(events);',
      `not_afk = flood(query_bucket(${JSON.stringify(afkBucket.id)}));`,
      'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
      'active_events = filter_period_intersect(events, not_afk);',
      'RETURN = {"activeSeconds": sum_durations(active_events), "observedSeconds": observed_seconds};'
    ]
    const values = await json(`${api}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, timeperiods: recentPeriods(31) })
    })
    assert.equal(Array.isArray(values), true, 'query result was not an array')
    assert.equal(values.length, 31, 'query did not return all 31 bounded periods')
    queries += 1
    nextQueryAt = Date.now() + queryIntervalMs
  }
  samples += 1
  await new Promise((resolveWait) => setTimeout(resolveWait, sampleIntervalMs))
}

const report = {
  ok: true,
  durationMs: Date.now() - startedAt,
  samples,
  queries,
  maxBucketAgeMs,
  version,
  finishedAt: new Date().toISOString()
}
writeFileSync(join(artifacts, 'reliability-soak-v0.7.2.json'), JSON.stringify(report, null, 2), 'utf8')
process.stdout.write(`RELIABILITY SOAK PASS: ${JSON.stringify(report)}\n`)
