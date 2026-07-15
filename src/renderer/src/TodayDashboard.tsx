import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ActivitySummary, BootstrapData, ProjectUsage, TimelineSlice } from '../../shared/contracts'

const APP_COLORS = ['#6e8ff8', '#aa7df2', '#f09a62', '#52c7d9', '#ef6f9b']
const PROJECT_COLORS = ['#72e1b2', '#54cfa0', '#91ebc5', '#3db789', '#a8f0d2']
const AFK_COLOR = '#3b4652'
const PENDING_COLOR = '#c69a52'

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (seconds > 0 && minutes === 0) return '<1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function compactDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} 秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分`
  return `${Math.floor(minutes / 60)}时${minutes % 60 ? `${minutes % 60}分` : ''}`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function colorFor(kind: TimelineSlice['kind'], key: string, index: number): string {
  if (kind === 'project') return PROJECT_COLORS[index % PROJECT_COLORS.length]
  if (kind === 'codex-unclassified') return PENDING_COLOR
  if (kind === 'afk') return AFK_COLOR
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return APP_COLORS[hash % APP_COLORS.length]
}

function statusCopy(status: ActivitySummary['focus']['status']): string {
  return {
    confirmed: '已确认项目',
    recent: '最近确认 · 当前归属未确认',
    unclassified: 'Codex 待分类',
    application: '当前应用',
    afk: '离开电脑',
    idle: '等待活动',
    paused: '记录已暂停',
    disconnected: '采集服务未连接'
  }[status]
}

export function TodayDashboard({ data, busy, onView, run, onActivity }: {
  data: BootstrapData
  busy: string
  onView: (view: 'plan' | 'review' | 'diagnostics') => void
  run: (name: string, action: () => Promise<void>) => Promise<void>
  onActivity: (activity: ActivitySummary) => void
}) {
  const { activity } = data
  const [editing, setEditing] = useState<ProjectUsage | null>(null)
  const [alias, setAlias] = useState('')
  const total = Math.max(activity.activeSeconds, 1)
  const sliceColors = useMemo(() => new Map(activity.attentionSlices.map((slice, index) => [
    `${slice.kind}:${slice.key}`,
    colorFor(slice.kind, slice.key, index)
  ])), [activity.attentionSlices])
  let turn = 0
  const gradient = activity.attentionSlices.length
    ? `conic-gradient(${activity.attentionSlices.map((slice) => {
        const start = turn
        turn += (slice.seconds / total) * 360
        return `${sliceColors.get(`${slice.kind}:${slice.key}`)} ${start}deg ${turn}deg`
      }).join(',')})`
    : 'conic-gradient(#26313a 0deg 360deg)'

  const startEdit = (project: ProjectUsage) => {
    setEditing(project)
    setAlias(project.label)
  }
  const saveAlias = () => run('project-alias', async () => {
    if (!editing) return
    onActivity(await window.timeEfficiency.setProjectAlias({ projectKey: editing.key, label: alias }))
    setEditing(null)
  })

  return <div className="dashboard">
    {(data.reminders.morningDue || data.reminders.eveningDue) && <button className="dashboard-reminder" onClick={() => onView(data.reminders.eveningDue ? 'review' : 'plan')}>
      <span>{data.reminders.eveningDue ? '晚间复盘待完成' : '早间计划待确认'}</span>
      <strong>现在完成 →</strong>
    </button>}

    <section className={`focus-strip focus-${activity.focus.status}`} data-testid="focus-strip">
      <div className="focus-glyph">{activity.focus.status === 'afk' ? '—' : 'C'}</div>
      <div className="focus-copy">
        <p>{statusCopy(activity.focus.status)}</p>
        <h2>{activity.focus.label}</h2>
        <small>{activity.focus.status === 'recent'
          ? '你仍在操作电脑，但当前应用的项目归属没有可信信号，因此不继续计入该项目。'
          : activity.focus.status === 'confirmed'
            ? '由当前 Codex 根任务自动确认，无需手动切换。'
            : activity.focus.app ? `${activity.focus.app} · 仅计算前台且非 AFK 的时间` : '状态来自本机 ActivityWatch 与上下文识别。'}</small>
      </div>
      <div className="focus-timer"><span>连续专注</span><strong>{compactDuration(activity.focus.continuousSeconds)}</strong></div>
    </section>

    <section className="dashboard-top">
      <article className="panel attention-overview" data-testid="attention-overview">
        <div className="panel-head compact-head"><div><p className="eyebrow">TODAY'S ATTENTION</p><h2>今天的注意力去了哪里</h2></div><button className="text-button" disabled={busy === 'refresh'} onClick={() => run('refresh', async () => onActivity(await window.timeEfficiency.refreshActivity()))}>{busy === 'refresh' ? '刷新中…' : '刷新'}</button></div>
        <div className="attention-layout">
          <div className="donut-wrap">
            <div className="attention-donut" style={{ '--donut': gradient } as CSSProperties}>
              <div><strong>{duration(activity.activeSeconds)}</strong><span>有效电脑时间</span></div>
            </div>
            <p>统一分母：排除 AFK 后的全部前台注意力</p>
          </div>
          <div className="attention-legend">
            {activity.attentionSlices.length ? activity.attentionSlices.slice(0, 8).map((slice) => <div key={`${slice.kind}:${slice.key}`}>
              <i style={{ background: sliceColors.get(`${slice.kind}:${slice.key}`) }} />
              <span><strong>{slice.label}</strong><small>{slice.kind === 'project' ? 'Codex 项目' : slice.kind === 'codex-unclassified' ? 'Codex · 待分类' : '应用'}</small></span>
              <em>{duration(slice.seconds)}<small>{Math.round((slice.seconds / total) * 100)}%</small></em>
            </div>) : <div className="dashboard-empty">正在等待第一批窗口事件。</div>}
          </div>
        </div>
      </article>

      <div className="compact-metrics">
        <article><span>电脑活跃</span><strong>{duration(activity.activeSeconds)}</strong><small>已排除 {duration(activity.afkSeconds)} AFK</small></article>
        <article><span>Codex 注意力</span><strong>{duration(activity.codexActiveSeconds)}</strong><small>前台且非 AFK</small></article>
        <article><span>项目覆盖</span><strong>{activity.codexCoveragePercent}%</strong><small>{activity.codexUnclassifiedSeconds ? `${duration(activity.codexUnclassifiedSeconds)} 待分类` : '没有待分类时间'}</small></article>
      </div>
    </section>

    <Timeline activity={activity} colors={sliceColors} />

    <section className="dashboard-details">
      <article className="panel detail-panel">
        <div className="panel-head compact-head"><div><p className="eyebrow">CODEX PROJECTS</p><h2>项目明细</h2></div><span className="coverage">合计 = Codex {duration(activity.codexActiveSeconds)}</span></div>
        {activity.projects.length ? <div className="detail-list">{activity.projects.map((project, index) => <div key={project.key} className={project.classified ? '' : 'pending'}>
          <i style={{ background: project.classified ? PROJECT_COLORS[index % PROJECT_COLORS.length] : PENDING_COLOR }} />
          <span><strong>{project.label}</strong><small>{project.classified ? `${project.threadCount} 个对话 · ${project.latestThreadName ?? '未命名对话'}` : '没有可信上下文，因此没有猜测归属'}</small></span>
          <em>{duration(project.seconds)}</em>
          {project.classified && <button className="text-button" onClick={() => startEdit(project)}>更名</button>}
        </div>)}</div> : <p className="dashboard-empty">还没有 Codex 前台注意力。</p>}
        {editing && <div className="inline-editor"><label><span>只更改显示名称，不会合并项目</span><input autoFocus value={alias} maxLength={60} onChange={(event) => setAlias(event.target.value)} /></label><div><button className="secondary" onClick={() => setEditing(null)}>取消</button><button className="primary" disabled={!alias.trim() || busy === 'project-alias'} onClick={() => void saveAlias()}>保存</button></div></div>}
      </article>
      <article className="panel detail-panel">
        <div className="panel-head compact-head"><div><p className="eyebrow">APPLICATIONS</p><h2>应用明细</h2></div></div>
        {activity.apps.length ? <div className="detail-list">{activity.apps.slice(0, 7).map((app, index) => <div key={app.app}>
          <i style={{ background: colorFor('application', `app:${app.app.toLocaleLowerCase()}`, index) }} />
          <span><strong>{app.app}</strong><small title={app.topTitles[0]?.title}>{app.topTitles[0]?.title ?? '无窗口标题'}</small></span>
          <em>{duration(app.seconds)}</em>
        </div>)}</div> : <p className="dashboard-empty">还没有应用数据。</p>}
      </article>
    </section>

    {!activity.connected && <section className="dashboard-disconnected"><span>ActivityWatch 未连接：{activity.error}</span><button onClick={() => onView('diagnostics')}>查看诊断</button></section>}
  </div>
}

function Timeline({ activity, colors }: { activity: ActivitySummary; colors: Map<string, string> }) {
  const ordered = [...activity.timeline].sort((a, b) => a.start.localeCompare(b.start))
  if (!ordered.length) return <section className="panel timeline-panel" data-testid="attention-timeline"><div className="panel-head compact-head"><div><p className="eyebrow">CHRONOLOGICAL</p><h2>今天的时间轴</h2></div></div><p className="dashboard-empty">采集开始后，这里会按发生顺序显示项目、应用和离开时段。</p></section>
  const rangeStart = new Date(ordered[0].start).getTime()
  const rangeEnd = Math.max(...ordered.map((slice) => new Date(slice.end).getTime()))
  const range = Math.max(rangeEnd - rangeStart, 1)
  const ticks = Array.from({ length: 5 }, (_, index) => new Date(rangeStart + (range * index) / 4).toISOString())
  return <section className="panel timeline-panel" data-testid="attention-timeline">
    <div className="panel-head compact-head"><div><p className="eyebrow">CHRONOLOGICAL</p><h2>今天的时间轴</h2></div><small>只展示 {clock(ordered[0].start)}–{clock(new Date(rangeEnd).toISOString())} 的实际记录区间</small></div>
    <div className="timeline-track">
      {ordered.map((slice, index) => {
        const left = ((new Date(slice.start).getTime() - rangeStart) / range) * 100
        const width = ((new Date(slice.end).getTime() - new Date(slice.start).getTime()) / range) * 100
        const color = slice.kind === 'afk' ? AFK_COLOR : colors.get(`${slice.kind}:${slice.key}`) ?? colorFor(slice.kind, slice.key, index)
        return <div key={slice.id} className={`timeline-segment ${slice.kind}`} style={{ left: `${left}%`, width: `${Math.max(width, .35)}%`, background: color }} title={`${clock(slice.start)}–${clock(slice.end)} · ${slice.label} · ${duration(slice.seconds)}`}>
          {width > 8 && <span>{slice.kind === 'project' ? 'C · ' : ''}{slice.label}</span>}
        </div>
      })}
    </div>
    <div className="timeline-ticks">{ticks.map((tick) => <span key={tick}>{clock(tick)}</span>)}</div>
    <div className="timeline-events">{ordered.slice(-8).map((slice, index) => <div key={`${slice.id}:event`}><i style={{ background: slice.kind === 'afk' ? AFK_COLOR : colors.get(`${slice.kind}:${slice.key}`) ?? colorFor(slice.kind, slice.key, index) }} /><span>{clock(slice.start)}–{clock(slice.end)}</span><strong>{slice.kind === 'project' ? `Codex · ${slice.label}` : slice.label}</strong><em>{compactDuration(slice.seconds)}</em></div>)}</div>
  </section>
}
