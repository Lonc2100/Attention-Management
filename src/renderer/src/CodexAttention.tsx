import { useState } from 'react'
import type { ActivitySummary, ProjectUsage } from '../../shared/contracts'

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

export function CodexContextBanner({ activity }: { activity: ActivitySummary }) {
  const { codexContext } = activity
  const current = codexContext.current
  const live = codexContext.foreground && codexContext.active && current

  return <section className={`context-banner ${live ? 'live' : ''}`}>
    <div className="context-icon">C</div>
    <div>
      <p className="eyebrow">CONFIRMED CONTEXT · 无需手动切换</p>
      <strong>{current ? `${live ? '正在计入' : '最近确认'}：${current.projectLabel}` : '等待确认 Codex 上下文'}</strong>
      <small>
        {current
          ? `${current.threadName ?? '未命名对话'} · ${live ? '以最近发起交互的根任务为边界' : '仅 Codex 前台且非 AFK 时计时'}`
          : codexContext.error ?? '在任意 Codex 根任务中发起一次交互后会自动确认；此前没有可信信号的时间进入待分类。'}
      </small>
    </div>
    <span className="auto-chip">{live ? '识别中' : '自动检测'}</span>
  </section>
}

export function ProjectAttentionPanel({ activity, busy, run, onChange }: {
  activity: ActivitySummary
  busy: string
  run: (name: string, action: () => Promise<void>) => Promise<void>
  onChange: (activity: ActivitySummary) => void
}) {
  const [editing, setEditing] = useState<ProjectUsage | null>(null)
  const [label, setLabel] = useState('')
  const maximum = Math.max(...activity.projects.map((project) => project.seconds), 1)

  const beginEdit = (project: ProjectUsage) => {
    setEditing(project)
    setLabel(project.label)
  }

  const save = () => run('project-alias', async () => {
    if (!editing) return
    const next = await window.timeEfficiency.setProjectAlias({ projectKey: editing.key, label })
    onChange(next)
    setEditing(null)
  })

  return <article className="panel project-panel">
    <div className="panel-head">
      <div><p className="eyebrow">CODEX ATTENTION</p><h2>项目注意力</h2></div>
      <span className="coverage">已分类 {activity.codexCoveragePercent}%</span>
    </div>
    {!activity.connected ? <p className="muted">ActivityWatch 未连接，暂时无法计算前台注意力。</p> : !activity.projects.length ? <div className="empty compact"><p>还没有 Codex 前台注意力。打开一个 Codex 任务后会自动分类。</p></div> : <div className="project-list">
      {activity.projects.map((project) => <div className={`project-row ${project.classified ? '' : 'pending'}`} key={project.key}>
        <div className="project-main">
          <div><strong>{project.label}</strong><span>{duration(project.seconds)}</span></div>
          <div className="bar"><i style={{ width: `${Math.max(4, (project.seconds / maximum) * 100)}%` }} /></div>
          <small>{project.classified ? `${project.latestThreadName ?? '未命名对话'} · ${project.threadCount} 个对话` : '这段时间没有可信的上下文样本，因此没有猜测归属。'}</small>
        </div>
        {project.classified && <button className="text-button rename" onClick={() => beginEdit(project)}>更正名称</button>}
      </div>)}
    </div>}
    {editing && <div className="inline-editor">
      <label><span>只更改显示名称，不会切换或合并任务</span><input autoFocus value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label>
      <div><button className="secondary" onClick={() => setEditing(null)}>取消</button><button className="primary" disabled={!label.trim() || busy === 'project-alias'} onClick={() => void save()}>{busy === 'project-alias' ? '保存中…' : '保存名称'}</button></div>
    </div>}
    <p className="panel-footnote">项目时间只统计 Codex 处于前台且你未离开电脑的区间。官方信号在新一轮交互开始时确认任务；只点开聊天但未发起交互不会改变归属。</p>
  </article>
}
