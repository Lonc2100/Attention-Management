import { describe, expect, it } from 'vitest'
import { classifyActivityDay } from '../src/main/classification'
import type { ActivityEvent, ActivityOverride, ActivityRule } from '../src/shared/contracts'

describe('activity classification', () => {
  it('uses manual correction over rules and only applies learned rules from appliesFrom', () => {
    const start = Date.parse('2026-07-15T01:00:00.000Z')
    const windows: ActivityEvent[] = [{
      id: 1,
      timestamp: new Date(start).toISOString(),
      duration: 600,
      data: { app: 'chrome.exe', title: 'ActivityWatch rule research' }
    }]
    const rules: ActivityRule[] = [{
      id: 'rule-one', projectKey: 'manual:research', app: 'Chrome.exe', titleMatch: 'contains',
      titlePattern: 'activitywatch', enabled: true, createdAt: start + 300_000, appliesFrom: start + 300_000
    }]
    const overrides: ActivityOverride[] = [{
      id: 'override-one', date: '2026-07-15', start: new Date(start + 360_000).toISOString(),
      end: new Date(start + 420_000).toISOString(), app: 'chrome.exe', title: 'ActivityWatch rule research',
      projectKey: 'manual:attention', createdAt: start + 420_000
    }]

    const result = classifyActivityDay(windows, [], [], {}, rules, overrides, {
      'manual:research': '资料研究',
      'manual:attention': '时间效率助手'
    })

    expect(result.entries.map((entry) => [entry.attribution, entry.projectLabel, entry.seconds])).toEqual([
      ['application', 'chrome.exe', 300],
      ['rule', '资料研究', 60],
      ['manual', '时间效率助手', 60],
      ['rule', '资料研究', 180]
    ])
  })

  it('uses the first enabled matching rule and leaves disabled rules out', () => {
    const start = Date.parse('2026-07-15T02:00:00.000Z')
    const rules: ActivityRule[] = [
      { id: 'disabled', projectKey: 'manual:a', app: 'chrome.exe', titleMatch: 'contains', titlePattern: 'docs', enabled: false, createdAt: start, appliesFrom: start },
      { id: 'first', projectKey: 'manual:b', app: 'chrome.exe', titleMatch: 'contains', titlePattern: 'docs', enabled: true, createdAt: start, appliesFrom: start },
      { id: 'second', projectKey: 'manual:c', app: 'chrome.exe', titleMatch: 'exact', titlePattern: 'Docs', enabled: true, createdAt: start, appliesFrom: start }
    ]
    const result = classifyActivityDay(
      [{ id: 1, timestamp: new Date(start).toISOString(), duration: 60, data: { app: 'Chrome.exe', title: 'Docs' } }],
      [], [], {}, rules, [], { 'manual:a': 'A', 'manual:b': 'B', 'manual:c': 'C' }
    )
    expect(result.entries).toEqual([expect.objectContaining({ attribution: 'rule', projectKey: 'manual:b', ruleId: 'first' })])
  })

  it('subtracts AFK and keeps the source title as inspectable evidence', () => {
    const result = classifyActivityDay(
      [{ id: 1, timestamp: '2026-07-15T03:00:00.000Z', duration: 600, data: { app: 'Code.exe', title: '成果页面' } }],
      [{ id: 2, timestamp: '2026-07-15T03:04:00.000Z', duration: 120, data: { status: 'afk' } }],
      [], {}, [], [], {}
    )
    expect(result.activeSeconds).toBe(480)
    expect(result.entries.filter((entry) => entry.attribution !== 'afk').map((entry) => [entry.title, entry.seconds])).toEqual([
      ['成果页面', 240], ['成果页面', 240]
    ])
    expect(result.entries.find((entry) => entry.attribution === 'afk')).toMatchObject({ seconds: 120, correctable: false })
  })
})
