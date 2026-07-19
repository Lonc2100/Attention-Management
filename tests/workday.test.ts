import { describe, expect, it } from 'vitest'
import { buildWorkdayModel, currentWorkdayKey, workdayRange } from '../src/shared/workday'

function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 6, day, hour, minute).getTime()
}

describe('workday boundaries', () => {
  it('keeps post-midnight work with the session that started the previous day', () => {
    const model = buildWorkdayModel([
      { start: at(18, 20), end: at(18, 23, 59) },
      { start: at(19, 0), end: at(19, 2, 30) },
      { start: at(19, 10), end: at(19, 12) }
    ])

    expect(model.boundaries.map((item) => [item.workdayKey, new Date(item.at).getHours(), item.source])).toEqual([
      ['2026-07-18', 20, 'initial'],
      ['2026-07-19', 10, 'auto']
    ])
    expect(model.allocations.map((item) => item.workdayKey)).toEqual(['2026-07-18', '2026-07-18', '2026-07-19'])
  })

  it('does not turn a long daytime absence into another date', () => {
    const model = buildWorkdayModel([
      { start: at(19, 9), end: at(19, 11) },
      { start: at(19, 18), end: at(19, 23) }
    ])

    expect(model.boundaries.map((item) => item.workdayKey)).toEqual(['2026-07-19'])
    expect(new Set(model.allocations.map((item) => item.workdayKey))).toEqual(new Set(['2026-07-19']))
  })

  it('continues an all-nighter until a main rest actually finishes', () => {
    const model = buildWorkdayModel([
      { start: at(18, 22), end: at(19, 5) },
      { start: at(19, 5, 10), end: at(19, 11) },
      { start: at(19, 17), end: at(19, 20) }
    ])

    expect(model.boundaries.map((item) => item.workdayKey)).toEqual(['2026-07-18', '2026-07-19'])
    expect(model.boundaries[1]?.at).toBe(at(19, 17))
  })

  it('lets an explicit boundary override the automatic decision', () => {
    const manual = new Date(at(19, 8)).toISOString()
    const model = buildWorkdayModel([
      { start: at(18, 20), end: at(19, 2) },
      { start: at(19, 8), end: at(19, 12) }
    ], { '2026-07-19': manual })

    expect(model.boundaries.at(-1)).toMatchObject({ workdayKey: '2026-07-19', at: at(19, 8), source: 'manual' })
    expect(workdayRange(model, '2026-07-18')).toEqual({ start: at(18, 20), end: at(19, 2) })
    expect(currentWorkdayKey(model, at(19, 11))).toBe('2026-07-19')
  })
})
