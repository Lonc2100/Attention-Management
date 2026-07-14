import type { ActivityEvent, ActivitySummary, AfkNote, AfkPeriod, AppUsage } from '../shared/contracts'

function overlapSeconds(event: ActivityEvent, periods: AfkPeriod[]): number {
  const start = new Date(event.timestamp).getTime()
  const end = start + event.duration * 1000
  return periods.reduce((total, period) => {
    const pStart = new Date(period.start).getTime()
    const pEnd = new Date(period.end).getTime()
    return total + Math.max(0, Math.min(end, pEnd) - Math.max(start, pStart)) / 1000
  }, 0)
}

export function aggregateActivity(
  windowEvents: ActivityEvent[],
  afkEvents: ActivityEvent[],
  notes: AfkNote[],
  tracking: boolean,
  bucketIds: { window: string | null; afk: string | null }
): ActivitySummary {
  const afkPeriods = afkEvents
    .filter((event) => event.data.status === 'afk' && event.duration > 0)
    .map((event) => {
      const end = new Date(new Date(event.timestamp).getTime() + event.duration * 1000).toISOString()
      const note = notes.find((item) => item.start === event.timestamp || Math.abs(new Date(item.start).getTime() - new Date(event.timestamp).getTime()) < 1000)
      return { start: event.timestamp, end, seconds: event.duration, note: note?.note }
    })

  const apps = new Map<string, { seconds: number; titles: Map<string, number> }>()
  let activeSeconds = 0
  for (const event of windowEvents) {
    const active = Math.max(0, event.duration - overlapSeconds(event, afkPeriods))
    if (active <= 0) continue
    activeSeconds += active
    const app = event.data.app || '未知应用'
    const title = event.data.title || '无标题'
    const entry = apps.get(app) ?? { seconds: 0, titles: new Map<string, number>() }
    entry.seconds += active
    entry.titles.set(title, (entry.titles.get(title) ?? 0) + active)
    apps.set(app, entry)
  }

  const usage: AppUsage[] = [...apps.entries()]
    .map(([app, value]) => ({
      app,
      seconds: value.seconds,
      topTitles: [...value.titles.entries()]
        .map(([title, seconds]) => ({ title, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 3)
    }))
    .sort((a, b) => b.seconds - a.seconds)

  return {
    connected: true,
    tracking,
    windowBucketId: bucketIds.window,
    afkBucketId: bucketIds.afk,
    activeSeconds,
    afkSeconds: afkPeriods.reduce((sum, period) => sum + period.seconds, 0),
    apps: usage,
    afkPeriods: afkPeriods.sort((a, b) => b.start.localeCompare(a.start)),
    recentEvents: [...windowEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100),
    error: null,
    updatedAt: new Date().toISOString()
  }
}

export function disconnectedSummary(tracking: boolean, error: unknown): ActivitySummary {
  return {
    connected: false,
    tracking,
    windowBucketId: null,
    afkBucketId: null,
    activeSeconds: 0,
    afkSeconds: 0,
    apps: [],
    afkPeriods: [],
    recentEvents: [],
    error: error instanceof Error ? error.message : String(error),
    updatedAt: new Date().toISOString()
  }
}
