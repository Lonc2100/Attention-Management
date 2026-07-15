import { describe, expect, it } from 'vitest'
import { widgetBounds } from '../src/main/floating-window'

describe('floating widget placement', () => {
  const displays = [
    { id: '1', primary: true, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: '2', workArea: { x: 1920, y: 0, width: 1280, height: 984 } }
  ]

  it('opens at the upper-right of the primary display by default', () => {
    expect(widgetBounds(displays, { widgetExpanded: false, widgetPosition: null })).toEqual({
      x: 1586, y: 18, width: 316, height: 68
    })
  })

  it('restores and clamps a saved position on the requested display', () => {
    expect(widgetBounds(displays, {
      widgetExpanded: true,
      widgetPosition: { x: 4000, y: -100, displayId: '2' }
    })).toEqual({ x: 2864, y: 0, width: 336, height: 278 })
  })

  it('falls back to the primary display when the saved display disappeared', () => {
    expect(widgetBounds(displays, {
      widgetExpanded: false,
      widgetPosition: { x: 2000, y: 100, displayId: 'missing' }
    })).toEqual({ x: 1586, y: 18, width: 316, height: 68 })
  })
})
