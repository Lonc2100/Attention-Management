import { useEffect, useState } from 'react'
import type { ActivitySummary, BootstrapData, FocusStatus } from '../../shared/contracts'
import { widgetSharePercent } from '../../shared/widget-metrics'

function timerText(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function statusLabel(status: FocusStatus): string {
  return {
    confirmed: '项目已确认', recent: '最近确认', unclassified: '待分类', application: '当前应用',
    afk: '已离开电脑', idle: '等待活动', paused: '记录暂停', disconnected: '采集未连接'
  }[status]
}

export default function FloatingWidget() {
  const [data, setData] = useState<BootstrapData | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    void window.timeEfficiency.bootstrap().then(setData).catch(() => undefined)
    const clock = setInterval(() => setNow(Date.now()), 1_000)
    const refresh = setInterval(async () => {
      try {
        const activity = await window.timeEfficiency.refreshActivity()
        setData((current) => current ? { ...current, activity } : current)
      } catch {
        // Keep the last confirmed state; the next refresh may recover.
      }
    }, 10_000)
    return () => { clearInterval(clock); clearInterval(refresh) }
  }, [])
  if (!data) return <div className="widget-card widget-loading">正在连接…</div>
  const { focus } = data.activity
  const liveSeconds = focus.startedAt && !['recent', 'paused', 'disconnected', 'idle'].includes(focus.status)
    ? Math.max(focus.continuousSeconds, (now - new Date(focus.startedAt).getTime()) / 1000)
    : focus.continuousSeconds
  const expanded = data.settings.widgetExpanded
  const sharePercent = widgetSharePercent(focus.projectTodaySeconds, data.activity.activeSeconds)
  const setExpanded = async () => {
    const settings = await window.timeEfficiency.setWidgetExpanded(!expanded)
    setData({ ...data, settings })
  }
  return <section className={`widget-card ${expanded ? 'expanded' : ''} widget-${focus.status}`} data-testid="floating-widget">
    <div className="widget-primary widget-drag">
      <span className="widget-dot"><i /></span>
      <div className="widget-context"><small>{statusLabel(focus.status)}</small><strong title={focus.label}>{focus.label}</strong></div>
      <div className="widget-timer"><small>连续专注</small><time>{timerText(liveSeconds)}</time></div>
      <button className="widget-action no-drag" aria-label={expanded ? '折叠悬浮窗' : '展开悬浮窗'} onClick={() => void setExpanded()}>{expanded ? '−' : '+'}</button>
    </div>
    {expanded && <div className="widget-expanded">
      <div className="widget-stats">
        <div className="widget-stat"><span>今日该项目</span><strong>{duration(focus.projectTodaySeconds)}</strong></div>
        <div className="widget-stat"><span>电脑活跃</span><strong>{duration(data.activity.activeSeconds)}</strong></div>
      </div>
      <div className="widget-progress-row"><span>{focus.projectKey ? '本项目 / 已记录电脑时间' : '当前上下文 / 已记录电脑时间'}</span><strong>{sharePercent}%</strong></div>
      <div className="widget-progress"><i style={{ width: `${sharePercent}%` }} /></div>
      <div className="widget-footer"><p>{focus.status === 'recent' ? '归属信号中断，项目计时已停止' : '前台注意力 · 每 10 秒更新'}</p><div className="widget-buttons"><button className="no-drag" aria-label="打开驾驶舱" onClick={() => window.timeEfficiency.showWindow()}>打开</button><button className="no-drag" aria-label="隐藏" onClick={() => window.timeEfficiency.hideWidget()}>隐藏</button></div></div>
    </div>}
  </section>
}
