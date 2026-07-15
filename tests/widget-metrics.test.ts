import { describe, expect, it } from 'vitest'
import { widgetSharePercent } from '../src/shared/widget-metrics'

describe('widget share percentage', () => {
  it('uses the same rounded minutes shown by the widget', () => {
    expect(widgetSharePercent(17 * 60 + 40, 5 * 3600 + 23 * 60)).toBe(6)
  })

  it('stays safe when there is no active time', () => {
    expect(widgetSharePercent(120, 0)).toBe(0)
  })
})
