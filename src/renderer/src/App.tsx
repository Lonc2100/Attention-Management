import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ActivitySummary,
  AfkPeriod,
  BootstrapData,
  Diagnostics,
  OutcomeStatus,
  Settings
} from '../../shared/contracts'
import { TodayDashboard } from './TodayDashboard'
import { ActivityDetailsView } from './ActivityDetailsView'
import { InsightsView } from './InsightsView'
import { buildOutcomeEvidence } from '../../shared/outcome-insights'

type View = 'today' | 'activities' | 'insights' | 'plan' | 'review' | 'diagnostics' | 'settings'

const EMPTY_ACTIVITY: ActivitySummary = {
  connected: false,
  tracking: false,
  windowBucketId: null,
  afkBucketId: null,
  activeSeconds: 0,
  afkSeconds: 0,
  apps: [],
  projects: [],
  codexActiveSeconds: 0,
  codexClassifiedSeconds: 0,
  codexUnclassifiedSeconds: 0,
  codexCoveragePercent: 0,
  codexContext: {
    available: false,
    foreground: false,
    active: false,
    provider: 'codex-app-server',
    current: null,
    lastDetectedAt: null,
    error: null
  },
  timeline: [],
  attentionSlices: [],
  focus: { status: 'disconnected', label: '采集服务未连接', projectKey: null, app: null, startedAt: null, continuousSeconds: 0, projectTodaySeconds: 0 },
  afkPeriods: [],
  recentEvents: [],
  error: null,
  updatedAt: new Date().toISOString()
}

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function focusDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  if (value < 60) return `${value} 秒`
  const minutes = Math.round(value / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: OutcomeStatus): string {
  return { pending: '未确认', done: '完成', partial: '部分完成', dropped: '放弃' }[status]
}

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null)
  const [view, setView] = useState<View>('today')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const e2eMode = new URLSearchParams(window.location.search).has('e2e')

  const load = async () => {
    try {
      setError('')
      setData(await window.timeEfficiency.bootstrap())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  useEffect(() => {
    void load()
    if (e2eMode) return
    const timer = setInterval(async () => {
      try {
        const activity = await window.timeEfficiency.refreshActivity()
        setData((current) => (current ? { ...current, activity } : current))
      } catch {
        // The visible status remains the last confirmed state.
      }
    }, 15_000)
    return () => clearInterval(timer)
  }, [e2eMode])

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return <main className="loading"><div className="pulse" />正在连接本机采集服务…{error && <p className="error">{error}</p>}</main>
  }

  const setActivity = (activity: ActivitySummary) => setData({ ...data, activity })
  const setSettings = (settings: Settings) => setData({ ...data, settings })

  return (
    <div className="shell">
      <aside>
        <div className="brand"><span className="brand-mark">T</span><div><strong>时间效率助手</strong><small>LOCAL WORK SYSTEM</small></div></div>
        <nav>
          <Nav active={view === 'today'} onClick={() => setView('today')} label="今日概览" />
          <Nav active={view === 'activities'} onClick={() => setView('activities')} label="活动明细" />
          <Nav active={view === 'insights'} onClick={() => setView('insights')} label="个人规律" />
          <Nav active={view === 'plan'} onClick={() => setView('plan')} label="早间计划" badge={data.reminders.morningDue ? '待完成' : undefined} />
          <Nav active={view === 'review'} onClick={() => setView('review')} label="晚间复盘" badge={data.reminders.eveningDue ? '待完成' : undefined} />
          <Nav active={view === 'diagnostics'} onClick={() => setView('diagnostics')} label="诊断" />
          <Nav active={view === 'settings'} onClick={() => setView('settings')} label="设置" />
        </nav>
        <div className="privacy-note">本机保存 · 不录屏<br />AI 只接收聚合摘要</div>
      </aside>
      <main>
        <header className={view === 'today' ? 'app-header app-header--today' : 'app-header'}>
          <div><p className="eyebrow">{data.date}</p><h1>{view === 'today' ? '把时间变成结果' : { activities: '活动明细', insights: '个人规律', plan: '早间计划', review: '晚间复盘', diagnostics: '系统诊断', settings: '设置' }[view]}</h1></div>
          {view === 'today' && <div className={`header-focus focus-${data.activity.focus.status}`} data-testid="focus-strip">
            <span className="header-focus__dot" />
            <div className="header-focus__copy"><small>{data.activity.focus.status === 'confirmed' ? '当前项目 · 自动识别' : '当前上下文'}</small><strong title={data.activity.focus.label}>{data.activity.focus.label}</strong></div>
            <div className="header-focus__timer"><small>连续专注</small><strong>{focusDuration(data.activity.focus.continuousSeconds)}</strong></div>
          </div>}
          <div className={`status ${data.activity.connected && data.activity.tracking ? 'online' : ''}`}>
            <span />{data.activity.connected ? (data.activity.tracking ? '正在真实记录' : '采集已暂停') : 'ActivityWatch 未连接'}
          </div>
        </header>
        {error && <div className="error-banner"><strong>操作未完成</strong>{error}<button onClick={() => setError('')}>×</button></div>}
        {view === 'today' && <Today data={data} busy={busy} setView={setView} run={run} setActivity={setActivity} onReload={load} />}
        {view === 'activities' && <ActivityDetailsView initialDate={data.date} onActivity={setActivity} />}
        {view === 'insights' && <InsightsView />}
        {view === 'plan' && <Plan data={data} busy={busy} run={run} onReload={load} />}
        {view === 'review' && <ReviewView data={data} busy={busy} run={run} onReload={load} />}
        {view === 'diagnostics' && <DiagnosticsView initial={data.diagnostics} busy={busy} run={run} />}
        {view === 'settings' && <SettingsView settings={data.settings} activity={data.activity} busy={busy} run={run} setSettings={setSettings} setActivity={setActivity} onReload={load} />}
      </main>
    </div>
  )
}

function Nav({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: string }) {
  return <button className={active ? 'active' : ''} onClick={onClick}><span>{label}</span>{badge && <em>{badge}</em>}</button>
}

function Today({ data, busy, setView, run, setActivity, onReload }: {
  data: BootstrapData
  busy: string
  setView: (view: View) => void
  run: (name: string, action: () => Promise<void>) => Promise<void>
  setActivity: (activity: ActivitySummary) => void
  onReload: () => Promise<void>
}) {
  void onReload
  return <TodayDashboard data={data} busy={busy} onView={setView} run={run} onActivity={setActivity} />
}

function Plan({ data, busy, run, onReload }: { data: BootstrapData; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const existing = data.record.outcomes
  const [titles, setTitles] = useState([existing[0]?.title ?? '', existing[1]?.title ?? '', existing[2]?.title ?? ''])
  const ids = useMemo(() => [existing[0]?.id ?? crypto.randomUUID(), existing[1]?.id ?? crypto.randomUUID(), existing[2]?.id ?? crypto.randomUUID()], [])
  const [priority, setPriority] = useState(data.record.priorityOutcomeId ?? ids[0])
  const [projectKeys, setProjectKeys] = useState([
    existing[0]?.projectKeys ?? [], existing[1]?.projectKeys ?? [], existing[2]?.projectKeys ?? []
  ])
  const toggleProject = (index: number, key: string) => {
    const next = projectKeys.map((keys) => [...keys])
    next[index] = next[index].includes(key) ? next[index].filter((item) => item !== key) : [...next[index], key]
    setProjectKeys(next)
  }
  return <section className="panel form-panel">
    <p className="lead">只写今天结束时必须看得见的 1–3 个成果。关联项目后，系统才能用真实项目注意力为成果提供证据。</p>
    <div className="form-stack plan-outcomes">{titles.map((title, index) => <div key={ids[index]} className="plan-outcome-card">
      <label className="outcome-input"><input type="radio" name="priority" checked={priority === ids[index]} onChange={() => setPriority(ids[index])} disabled={!title.trim()} /><span>{index + 1}</span><input value={title} maxLength={100} placeholder={index === 0 ? '绝对优先：今天完成什么才算没有白过？' : '另一个重要成果（可选）'} onChange={(event) => { const next = [...titles]; next[index] = event.target.value; setTitles(next); if (index === 0 && !priority) setPriority(ids[0]) }} /></label>
      {title.trim() && <div className="project-picker"><small>关联项目（可多选）</small><div>{data.projectOptions.length ? data.projectOptions.map((project) => <label key={project.key} className={projectKeys[index].includes(project.key) ? 'selected' : ''}><input type="checkbox" checked={projectKeys[index].includes(project.key)} onChange={() => toggleProject(index, project.key)} /><span>{project.label}</span></label>) : <em>还没有可关联项目；先在 Codex 中打开项目或到活动明细里完成一次归类。</em>}</div></div>}
    </div>)}</div>
    <div className="form-footer"><small>不关联也可以保存，但成果注意力会明确显示“暂无可量化证据”。</small><button className="primary" disabled={busy === 'plan'} onClick={() => run('plan', async () => { const outcomes = titles.map((title, i) => ({ id: ids[i], title, projectKeys: projectKeys[i] })).filter((item) => item.title.trim()); await window.timeEfficiency.savePlan({ outcomes, priorityOutcomeId: priority }); await onReload() })}>{busy === 'plan' ? '保存中…' : data.record.planCompletedAt ? '更新今日计划' : '确认，开始今天'}</button></div>
  </section>
}

function ReviewView({ data, busy, run, onReload }: { data: BootstrapData; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const [statuses, setStatuses] = useState<Record<string, OutcomeStatus>>(data.record.review?.outcomeStatuses ?? {})
  const [score, setScore] = useState(data.record.review?.subjectiveScore ?? 3)
  const [summary, setSummary] = useState(data.record.review?.summary ?? '')
  const [tomorrow, setTomorrow] = useState(data.record.review?.tomorrowIntent ?? '')
  const [ai, setAi] = useState(data.record.aiAnalysis ?? '')
  const [editingAfk, setEditingAfk] = useState<AfkPeriod | null>(null)
  const [afkNote, setAfkNote] = useState('')
  const evidence = buildOutcomeEvidence(data.record, data.activity, data.projectOptions)
  const evidenceByOutcome = new Map(evidence.map((item) => [item.outcomeId, item]))
  const beginAfkEdit = (period: AfkPeriod) => { setEditingAfk(period); setAfkNote(period.note ?? '') }
  const saveAfk = () => void run('afk', async () => {
    if (!editingAfk) return
    await window.timeEfficiency.saveAfkNote({ id: editingAfk.start, start: editingAfk.start, end: editingAfk.end, note: afkNote })
    setEditingAfk(null)
    await onReload()
  })
  return <div className="grid review-grid">
    <section className="panel form-panel">
      <div className="panel-head"><div><p className="eyebrow">5 MINUTES</p><h2>结果先于时长</h2></div></div>
      {!data.record.outcomes.length && <div className="warning">今天没有早间计划。你仍可以复盘，但结果判断会缺少基准。</div>}
      <div className="review-outcomes">{data.record.outcomes.map((outcome) => { const item = evidenceByOutcome.get(outcome.id); return <label key={outcome.id}><span><strong>{outcome.id === data.record.priorityOutcomeId ? '★ ' : ''}{outcome.title}</strong><small>{item?.projectLabels.length ? `${item.projectLabels.join('、')} · ${duration(item.attentionSeconds)} 项目注意力` : '未关联项目 · 暂无可量化注意力证据'}</small></span><select value={statuses[outcome.id] ?? 'pending'} onChange={(event) => setStatuses({ ...statuses, [outcome.id]: event.target.value as OutcomeStatus })}>{(['pending', 'done', 'partial', 'dropped'] as OutcomeStatus[]).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label> })}</div>
      <label className="field"><span>主观效率（1–5）</span><input type="range" min="1" max="5" value={score} onChange={(event) => setScore(Number(event.target.value))} /><strong>{score}</strong></label>
      <label className="field block"><span>今天真正推进了什么？</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="用结果说话，也可以记录阻塞。" /></label>
      <label className="field block"><span>明天首先做什么？</span><input value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} placeholder="先留下一个方向，明早再正式确认。" /></label>
      <button className="primary full" disabled={busy === 'review'} onClick={() => run('review', async () => { await window.timeEfficiency.saveReview({ outcomeStatuses: statuses, subjectiveScore: score, summary, tomorrowIntent: tomorrow }); await onReload() })}>{busy === 'review' ? '保存中…' : '保存今日复盘'}</button>
    </section>
    <div className="stack">
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">AFK IS NOT FAILURE</p><h2>离开电脑</h2></div></div>{data.activity.afkPeriods.length ? <div className="afk-list">{data.activity.afkPeriods.slice(0, 8).map((period) => <button key={period.start} onClick={() => beginAfkEdit(period)}><span>{clock(period.start)}–{clock(period.end)}</span><strong>{duration(period.seconds)}</strong><small>{period.note || '点击补记线下活动'}</small></button>)}</div> : <p className="muted">今天还没有检测到离开时段。</p>}{editingAfk && <div className="inline-editor"><label><span>这段时间你在做什么？</span><input autoFocus value={afkNote} onChange={(event) => setAfkNote(event.target.value)} placeholder="如：散步、吃饭、线下讨论" /></label><div><button className="secondary" onClick={() => setEditingAfk(null)}>取消</button><button className="primary" disabled={busy === 'afk'} onClick={saveAfk}>{busy === 'afk' ? '保存中…' : '保存记录'}</button></div></div>}</section>
      <section className="panel ai-panel"><div className="panel-head"><div><p className="eyebrow">CODEX CLI · REAL CALL</p><h2>AI 复盘建议</h2></div></div>{ai ? <div className="ai-answer">{ai}</div> : <p className="muted">只发送项目/应用时长聚合、成果状态和你写的复盘；不发送任务 ID、文件夹路径或完整窗口标题流水。</p>}<button className="secondary full" disabled={busy === 'ai'} onClick={() => run('ai', async () => setAi((await window.timeEfficiency.runAiReview()).text))}>{busy === 'ai' ? 'Codex 正在分析…' : ai ? '重新分析' : '调用 Codex 生成复盘'}</button></section>
    </div>
  </div>
}

function DiagnosticsView({ initial, busy, run }: { initial: Diagnostics; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void> }) {
  const [items, setItems] = useState(initial)
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">NO FAKE GREEN LIGHTS</p><h2>真实链路状态</h2></div><button className="secondary" disabled={busy === 'diagnostics'} onClick={() => run('diagnostics', async () => setItems(await window.timeEfficiency.getDiagnostics()))}>{busy === 'diagnostics' ? '检测中…' : '重新检测'}</button></div><div className="diagnostics">{Object.entries(items).map(([key, value]) => <div key={key}><span className={value.ok ? 'ok' : 'bad'}>{value.ok ? '✓' : '!'}</span><div><strong>{({ activityWatch: 'ActivityWatch 服务', windowWatcher: '窗口采集桶', afkWatcher: 'AFK 采集桶', storage: '本地数据', codexCli: 'Codex CLI', codexContext: 'Codex 项目识别', launchAtLogin: 'Windows 自启动' } as Record<string, string>)[key]}</strong><small>{value.detail}</small></div></div>)}</div></section>
}

function SettingsView({ settings, activity, busy, run, setSettings, setActivity, onReload }: { settings: Settings; activity: ActivitySummary; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; setSettings: (settings: Settings) => void; setActivity: (activity: ActivitySummary) => void; onReload: () => Promise<void> }) {
  const update = (patch: Partial<Settings>) => run('settings', async () => setSettings(await window.timeEfficiency.updateSettings(patch)))
  return <section className="panel settings">
    <div className="settings-group"><p className="eyebrow">FLOATING FOCUS</p><h2>悬浮专注窗</h2></div>
    <SettingRow title="显示悬浮专注窗" note="显示当前项目与连续专注时间；隐藏后仍可从托盘恢复。"><button className="secondary" onClick={() => window.timeEfficiency.showWidget()}>显示悬浮窗</button></SettingRow>
    <SettingRow title="悬浮方式" note="置顶模式持续可见；桌面模式允许其他窗口覆盖它。"><select aria-label="悬浮方式" value={settings.widgetMode} disabled={busy === 'settings'} onChange={(event) => update({ widgetMode: event.target.value as Settings['widgetMode'] })}><option value="always-on-top">默认置顶</option><option value="desktop">停留桌面</option></select></SettingRow>
    <div className="settings-group separated"><p className="eyebrow">CAPTURE</p><h2>采集与启动</h2></div>
    <SettingRow title="时间采集" note="只记录前台应用、窗口标题和 AFK；不录屏、不记录按键正文。"><button className={activity.tracking ? 'danger' : 'primary'} disabled={busy === 'tracking'} onClick={() => run('tracking', async () => { setActivity(await window.timeEfficiency.setTracking(!activity.tracking)); await onReload() })}>{busy === 'tracking' ? '处理中…' : activity.tracking ? '暂停采集' : '恢复采集'}</button></SettingRow>
    <SettingRow title="登录 Windows 后自动启动" note="默认开启；你可以随时关闭。"><button className={`switch ${settings.launchAtLogin ? 'on' : ''}`} disabled={busy === 'settings'} onClick={() => update({ launchAtLogin: !settings.launchAtLogin })}><i /></button></SettingRow>
    <SettingRow title="早间计划提醒" note="若当时关机，会在下次启动时补提醒。"><input type="time" value={settings.morningReminder} onChange={(event) => update({ morningReminder: event.target.value })} /></SettingRow>
    <SettingRow title="晚间复盘提醒" note="初始固定时间；后续可根据个人规律调整。"><input type="time" value={settings.eveningReminder} onChange={(event) => update({ eveningReminder: event.target.value })} /></SettingRow>
    <SettingRow title="AI 通道" note="使用本机已登录的 Codex CLI，不需要额外 API Key。"><span className="chip">Codex CLI</span></SettingRow>
  </section>
}

function SettingRow({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <div className="setting-row"><div><strong>{title}</strong><small>{note}</small></div>{children}</div>
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><small>{note}</small></article>
}

function Empty({ text, action, onClick }: { text: string; action?: string; onClick?: () => void }) {
  return <div className="empty"><p>{text}</p>{action && <button className="secondary" onClick={onClick}>{action}</button>}</div>
}
