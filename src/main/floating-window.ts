import type { BrowserWindow, Rectangle } from 'electron'
import type { Settings } from '../shared/contracts'

export const WIDGET_SIZE = {
  collapsed: { width: 316, height: 68 },
  expanded: { width: 322, height: 214 }
} as const

export interface DisplayArea {
  id: string
  workArea: Rectangle
  primary?: boolean
}

export function widgetBounds(
  displays: DisplayArea[],
  settings: Pick<Settings, 'widgetExpanded' | 'widgetPosition'>
): Rectangle {
  const size = settings.widgetExpanded ? WIDGET_SIZE.expanded : WIDGET_SIZE.collapsed
  const requestedDisplay = settings.widgetPosition
    ? displays.find((display) => display.id === settings.widgetPosition?.displayId)
    : null
  if (requestedDisplay && settings.widgetPosition) {
    const { workArea } = requestedDisplay
    const x = Math.min(Math.max(settings.widgetPosition.x, workArea.x), workArea.x + workArea.width - size.width)
    const y = Math.min(Math.max(settings.widgetPosition.y, workArea.y), workArea.y + workArea.height - size.height)
    return { x, y, ...size }
  }
  const target = displays.find((display) => display.primary) ?? displays[0]
  if (!target) return { x: 24, y: 24, ...size }
  return {
    x: target.workArea.x + target.workArea.width - size.width - 18,
    y: target.workArea.y + 18,
    ...size
  }
}

export function applyWidgetMode(window: BrowserWindow, mode: Settings['widgetMode']): void {
  window.setAlwaysOnTop(mode === 'always-on-top', 'floating')
  window.setSkipTaskbar(true)
}
