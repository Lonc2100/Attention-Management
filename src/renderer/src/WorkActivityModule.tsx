import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FocusEvent, MouseEvent } from 'react'
import type { WorkActivityCell, WorkActivityDashboard, WorkActivityMode } from '../../shared/contracts'
import { workActivityLevel } from '../../shared/work-activity'
import { PageModule, SegmentedControl } from './ui/PageModules'

const MODES = [
  { value: 'day', label: '每日' },
  { value: 'week', label: '每周' },
  { value: 'month', label: '每月' }
] as const

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (seconds > 0 && minutes === 0) return '<1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时${minutes % 60 ? ` ${minutes % 60} 分` : ''}`
}

function dateLabel(cell: WorkActivityCell, mode: WorkActivityMode): string {
  if (mode === 'day') return new Date(`${cell.startDate}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
  if (mode === 'month') return new Date(`${cell.startDate}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
  return `${cell.startDate.slice(5).replace('-', '/')}–${cell.endDate.slice(5).replace('-', '/')}`
}

function mondayKey(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

type Tooltip = { cell: WorkActivityCell; x: number; y: number }

export function WorkActivityModule({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const [mode, setMode] = useState<WorkActivityMode>('day')
  const [dashboard, setDashboard] = useState<WorkActivityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setDashboard(null)
    setTooltip(null)
    const load = () => void window.timeEfficiency.getWorkActivity(mode).then((next) => {
      if (active) setDashboard(next)
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    load()
    const refresh = window.setInterval(load, 5 * 60_000)
    return () => { active = false; window.clearInterval(refresh) }
  }, [mode])

  const dayWeeks = useMemo(() => {
    if (!dashboard || mode !== 'day') return []
    const weeks = new Map<string, WorkActivityCell[]>()
    for (const cell of dashboard.cells) {
      const key = mondayKey(cell.startDate)
      weeks.set(key, [...(weeks.get(key) ?? []), cell])
    }
    return [...weeks.entries()]
  }, [dashboard, mode])

  const showTooltip = (cell: WorkActivityCell, bounds: DOMRect) => {
    setTooltip({ cell, x: Math.min(bounds.left, window.innerWidth - 230), y: Math.max(12, bounds.top - 74) })
  }
  const showFromMouse = (cell: WorkActivityCell, event: MouseEvent<HTMLElement>) => showTooltip(cell, event.currentTarget.getBoundingClientRect())
  const showFromFocus = (cell: WorkActivityCell, event: FocusEvent<HTMLElement>) => showTooltip(cell, event.currentTarget.getBoundingClientRect())

  const cellButton = (cell: WorkActivityCell) => {
    const level = workActivityLevel(cell.activeSeconds, mode, cell.available)
    const label = `${dateLabel(cell, mode)}，${cell.available ? `实际电脑投入 ${duration(cell.activeSeconds)}` : '数据不可用'}`
    const style = mode === 'day' ? ({ gridRow: ((new Date(`${cell.startDate}T12:00:00`).getDay() + 6) % 7) + 1 } as CSSProperties) : undefined
    return <button
      type="button"
      key={cell.key}
      className={`work-activity__cell work-activity__cell--level-${level ?? 'unavailable'}`}
      style={style}
      aria-label={label}
      onMouseEnter={(event) => showFromMouse(cell, event)}
      onMouseLeave={() => setTooltip(null)}
      onFocus={(event) => showFromFocus(cell, event)}
      onBlur={() => setTooltip(null)}
      onClick={mode === 'day' ? () => onOpenDate(cell.endDate) : undefined}
    />
  }

  return <PageModule className="work-activity" variant="data" density="compact" data-testid="work-activity-module">
    <header className="work-activity__header">
      <div><h2>工作活动</h2><button type="button" className="work-activity__info" aria-label="查看工作活动统计口径" title="按非 AFK 的前台电脑活动统计；它是投入证据，不自动等同于成果。">i</button></div>
      <SegmentedControl ariaLabel="工作活动统计范围" value={mode} options={MODES} onChange={setMode} />
    </header>
    {loading && !dashboard ? <div className="work-activity__state">正在整理本机活动…</div> : error ? <div className="work-activity__state work-activity__state--error">{error}</div> : dashboard && <>
      <div className={`work-activity__chart work-activity__chart--${mode}`} aria-label={`${MODES.find((item) => item.value === mode)?.label}工作活动图`}>
        {mode === 'day' ? <div className="work-activity__day-layout">
          <div className="work-activity__weekdays" aria-hidden="true"><span>一</span><span>三</span><span>五</span><span>日</span></div>
          <div className="work-activity__day-scroll"><div className="work-activity__day-grid">{dayWeeks.map(([week, cells]) => <div className="work-activity__week" key={week}>{cells.map(cellButton)}</div>)}</div></div>
        </div> : <div className={`work-activity__period-grid work-activity__period-grid--${mode}`}>{dashboard.cells.map((cell) => <div className="work-activity__period" key={cell.key}>{cellButton(cell)}<small>{mode === 'month' ? cell.startDate.slice(5, 7) + '月' : cell.startDate.slice(5).replace('-', '/')}</small></div>)}</div>}
        <div className="work-activity__legend"><span>少</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`work-activity__cell--level-${level}`} />)}<span>多</span></div>
      </div>
      {!dashboard.available && <div className="work-activity__warning">ActivityWatch 暂不可用：{dashboard.error}</div>}
    </>}
    {tooltip && <div className="work-activity__tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}><strong>{dateLabel(tooltip.cell, mode)}</strong><span>{tooltip.cell.available ? duration(tooltip.cell.activeSeconds) : '数据不可用'}</span><small>{mode === 'day' ? '点击查看活动明细' : `${tooltip.cell.activeDays} 个有活动日`}</small></div>}
  </PageModule>
}
