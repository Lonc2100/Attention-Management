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

type View = 'today' | 'plan' | 'review' | 'diagnostics' | 'settings'

const EMPTY_ACTIVITY: ActivitySummary = {
  connected: false,
  tracking: false,
  windowBucketId: null,
  afkBucketId: null,
  activeSeconds: 0,
  afkSeconds: 0,
  apps: [],
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
    const timer = setInterval(async () => {
      try {
        const activity = await window.timeEfficiency.refreshActivity()
        setData((current) => (current ? { ...current, activity } : current))
      } catch {
        // The visible status remains the last confirmed state.
      }
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

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
          <Nav active={view === 'plan'} onClick={() => setView('plan')} label="早间计划" badge={data.reminders.morningDue ? '待完成' : undefined} />
          <Nav active={view === 'review'} onClick={() => setView('review')} label="晚间复盘" badge={data.reminders.eveningDue ? '待完成' : undefined} />
          <Nav active={view === 'diagnostics'} onClick={() => setView('diagnostics')} label="诊断" />
          <Nav active={view === 'settings'} onClick={() => setView('settings')} label="设置" />
        </nav>
        <div className="privacy-note">本机保存 · 不录屏<br />AI 只接收聚合摘要</div>
      </aside>
      <main>
        <header>
          <div><p className="eyebrow">{data.date}</p><h1>{view === 'today' ? '把时间变成结果' : { plan: '早间计划', review: '晚间复盘', diagnostics: '系统诊断', settings: '设置' }[view]}</h1></div>
          <div className={`status ${data.activity.connected && data.activity.tracking ? 'online' : ''}`}>
            <span />{data.activity.connected ? (data.activity.tracking ? '正在真实记录' : '采集已暂停') : 'ActivityWatch 未连接'}
          </div>
        </header>
        {error && <div className="error-banner"><strong>操作未完成</strong>{error}<button onClick={() => setError('')}>×</button></div>}
        {view === 'today' && <Today data={data} busy={busy} setView={setView} run={run} setActivity={setActivity} onReload={load} />}
        {view === 'plan' && <Plan data={data} busy={busy} run={run} onReload={load} />}
        {view === 'review' && <ReviewView data={data} busy={busy} run={run} onReload={load} />}
        {view === 'diagnostics' && <DiagnosticsView initial={data.diagnostics} busy={busy} run={run} />}
        {view === 'settings' && <SettingsView settings={data.settings} busy={busy} run={run} setSettings={setSettings} />}
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
  const top = data.activity.apps[0]
  return <>
    {(data.reminders.morningDue || data.reminders.eveningDue) && <section className="reminder">
      <div><strong>{data.reminders.eveningDue ? '你错过了晚间复盘时间' : '今天还没有确认计划'}</strong><p>这是根据本地完成状态生成的补提醒，不依赖关机时运行。</p></div>
      <button className="primary" onClick={() => setView(data.reminders.eveningDue ? 'review' : 'plan')}>现在完成</button>
    </section>}
    <section className="metrics">
      <Metric label="电脑活跃" value={duration(data.activity.activeSeconds)} note="已排除检测到的 AFK" />
      <Metric label="离开电脑" value={duration(data.activity.afkSeconds)} note="不自动等于低效率" />
      <Metric label="使用最多" value={top?.app ?? '暂无数据'} note={top ? duration(top.seconds) : '等待真实事件'} />
      <Metric label="重要成果" value={`${data.record.outcomes.length} / 3`} note={data.record.review ? '今日已复盘' : '以完成结果为准'} />
    </section>
    <section className="grid two">
      <article className="panel">
        <div className="panel-head"><div><p className="eyebrow">RESULTS FIRST</p><h2>今天最重要的成果</h2></div><button className="text-button" onClick={() => setView('plan')}>编辑</button></div>
        {data.record.outcomes.length ? <div className="outcome-list">{data.record.outcomes.map((outcome) => <div className="outcome" key={outcome.id}><span className={outcome.id === data.record.priorityOutcomeId ? 'priority-dot' : 'dot'} /> <div><strong>{outcome.title}</strong><small>{outcome.id === data.record.priorityOutcomeId ? '绝对优先项' : '重要成果'}</small></div></div>)}</div> : <Empty text="还没有计划。先写下今天必须产生的结果。" action="开始早间计划" onClick={() => setView('plan')} />}
      </article>
      <article className="panel">
        <div className="panel-head"><div><p className="eyebrow">REAL DATA</p><h2>应用时间</h2></div><button className="text-button" disabled={busy === 'refresh'} onClick={() => run('refresh', async () => setActivity(await window.timeEfficiency.refreshActivity()))}>{busy === 'refresh' ? '刷新中…' : '刷新'}</button></div>
        {!data.activity.connected ? <Empty text={data.activity.error ?? 'ActivityWatch 尚未连接。'} action="查看诊断" onClick={() => setView('diagnostics')} /> : data.activity.apps.length ? <div className="usage-list">{data.activity.apps.slice(0, 8).map((app) => <div key={app.app}><div><strong>{app.app}</strong><span>{duration(app.seconds)}</span></div><div className="bar"><i style={{ width: `${Math.max(4, (app.seconds / data.activity.apps[0].seconds) * 100)}%` }} /></div><small title={app.topTitles[0]?.title}>{app.topTitles[0]?.title}</small></div>)}</div> : <Empty text="连接成功，正在等待第一批窗口事件。" />}
      </article>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">CONTROL</p><h2>采集控制</h2></div><span className="muted">更新于 {clock(data.activity.updatedAt)}</span></div>
      <div className="control-row"><div><strong>{data.activity.tracking ? '窗口与离开检测正在运行' : '采集已由你暂停'}</strong><p>只记录前台应用、窗口标题和 AFK，不录屏、不记录按键正文。</p></div><button className={data.activity.tracking ? 'danger' : 'primary'} disabled={busy === 'tracking'} onClick={() => run('tracking', async () => { setActivity(await window.timeEfficiency.setTracking(!data.activity.tracking)); await onReload() })}>{busy === 'tracking' ? '处理中…' : data.activity.tracking ? '暂停采集' : '恢复采集'}</button></div>
    </section>
  </>
}

function Plan({ data, busy, run, onReload }: { data: BootstrapData; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const existing = data.record.outcomes
  const [titles, setTitles] = useState([existing[0]?.title ?? '', existing[1]?.title ?? '', existing[2]?.title ?? ''])
  const ids = useMemo(() => [existing[0]?.id ?? crypto.randomUUID(), existing[1]?.id ?? crypto.randomUUID(), existing[2]?.id ?? crypto.randomUUID()], [])
  const [priority, setPriority] = useState(data.record.priorityOutcomeId ?? ids[0])
  return <section className="panel form-panel">
    <p className="lead">不是列待办清单。只写今天结束时必须看得见的 1–3 个成果，并选出唯一不可牺牲的一项。</p>
    <div className="form-stack">{titles.map((title, index) => <label key={ids[index]} className="outcome-input"><input type="radio" name="priority" checked={priority === ids[index]} onChange={() => setPriority(ids[index])} disabled={!title.trim()} /><span>{index + 1}</span><input value={title} maxLength={100} placeholder={index === 0 ? '绝对优先：今天完成什么才算没有白过？' : '另一个重要成果（可选）'} onChange={(event) => { const next = [...titles]; next[index] = event.target.value; setTitles(next); if (index === 0 && !priority) setPriority(ids[0]) }} /></label>)}</div>
    <div className="form-footer"><small>选中的圆点 = 绝对优先项</small><button className="primary" disabled={busy === 'plan'} onClick={() => run('plan', async () => { const outcomes = titles.map((title, i) => ({ id: ids[i], title })).filter((item) => item.title.trim()); await window.timeEfficiency.savePlan({ outcomes, priorityOutcomeId: priority }); await onReload() })}>{busy === 'plan' ? '保存中…' : data.record.planCompletedAt ? '更新今日计划' : '确认，开始今天'}</button></div>
  </section>
}

function ReviewView({ data, busy, run, onReload }: { data: BootstrapData; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const [statuses, setStatuses] = useState<Record<string, OutcomeStatus>>(data.record.review?.outcomeStatuses ?? {})
  const [score, setScore] = useState(data.record.review?.subjectiveScore ?? 3)
  const [summary, setSummary] = useState(data.record.review?.summary ?? '')
  const [tomorrow, setTomorrow] = useState(data.record.review?.tomorrowIntent ?? '')
  const [ai, setAi] = useState(data.record.aiAnalysis ?? '')
  const saveAfk = (period: AfkPeriod) => {
    const note = window.prompt('这段离开电脑的时间，你在做什么？', period.note ?? '')
    if (note === null) return
    void run('afk', async () => { await window.timeEfficiency.saveAfkNote({ id: period.start, start: period.start, end: period.end, note }); await onReload() })
  }
  return <div className="grid review-grid">
    <section className="panel form-panel">
      <div className="panel-head"><div><p className="eyebrow">5 MINUTES</p><h2>结果先于时长</h2></div></div>
      {!data.record.outcomes.length && <div className="warning">今天没有早间计划。你仍可以复盘，但结果判断会缺少基准。</div>}
      <div className="review-outcomes">{data.record.outcomes.map((outcome) => <label key={outcome.id}><strong>{outcome.id === data.record.priorityOutcomeId ? '★ ' : ''}{outcome.title}</strong><select value={statuses[outcome.id] ?? 'pending'} onChange={(event) => setStatuses({ ...statuses, [outcome.id]: event.target.value as OutcomeStatus })}>{(['pending', 'done', 'partial', 'dropped'] as OutcomeStatus[]).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>)}</div>
      <label className="field"><span>主观效率（1–5）</span><input type="range" min="1" max="5" value={score} onChange={(event) => setScore(Number(event.target.value))} /><strong>{score}</strong></label>
      <label className="field block"><span>今天真正推进了什么？</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="用结果说话，也可以记录阻塞。" /></label>
      <label className="field block"><span>明天首先做什么？</span><input value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} placeholder="先留下一个方向，明早再正式确认。" /></label>
      <button className="primary full" disabled={busy === 'review'} onClick={() => run('review', async () => { await window.timeEfficiency.saveReview({ outcomeStatuses: statuses, subjectiveScore: score, summary, tomorrowIntent: tomorrow }); await onReload() })}>{busy === 'review' ? '保存中…' : '保存今日复盘'}</button>
    </section>
    <div className="stack">
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">AFK IS NOT FAILURE</p><h2>离开电脑</h2></div></div>{data.activity.afkPeriods.length ? <div className="afk-list">{data.activity.afkPeriods.slice(0, 8).map((period) => <button key={period.start} onClick={() => saveAfk(period)}><span>{clock(period.start)}–{clock(period.end)}</span><strong>{duration(period.seconds)}</strong><small>{period.note || '点击补记线下活动'}</small></button>)}</div> : <p className="muted">今天还没有检测到离开时段。</p>}</section>
      <section className="panel ai-panel"><div className="panel-head"><div><p className="eyebrow">CODEX CLI · REAL CALL</p><h2>AI 复盘建议</h2></div></div>{ai ? <div className="ai-answer">{ai}</div> : <p className="muted">只发送应用时长聚合、成果状态和你写的复盘，不发送完整窗口标题流水。</p>}<button className="secondary full" disabled={busy === 'ai'} onClick={() => run('ai', async () => setAi((await window.timeEfficiency.runAiReview()).text))}>{busy === 'ai' ? 'Codex 正在分析…' : ai ? '重新分析' : '调用 Codex 生成复盘'}</button></section>
    </div>
  </div>
}

function DiagnosticsView({ initial, busy, run }: { initial: Diagnostics; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void> }) {
  const [items, setItems] = useState(initial)
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">NO FAKE GREEN LIGHTS</p><h2>真实链路状态</h2></div><button className="secondary" disabled={busy === 'diagnostics'} onClick={() => run('diagnostics', async () => setItems(await window.timeEfficiency.getDiagnostics()))}>{busy === 'diagnostics' ? '检测中…' : '重新检测'}</button></div><div className="diagnostics">{Object.entries(items).map(([key, value]) => <div key={key}><span className={value.ok ? 'ok' : 'bad'}>{value.ok ? '✓' : '!'}</span><div><strong>{({ activityWatch: 'ActivityWatch 服务', windowWatcher: '窗口采集桶', afkWatcher: 'AFK 采集桶', storage: '本地数据', codexCli: 'Codex CLI', launchAtLogin: 'Windows 自启动' } as Record<string, string>)[key]}</strong><small>{value.detail}</small></div></div>)}</div></section>
}

function SettingsView({ settings, busy, run, setSettings }: { settings: Settings; busy: string; run: (name: string, action: () => Promise<void>) => Promise<void>; setSettings: (settings: Settings) => void }) {
  const update = (patch: Partial<Settings>) => run('settings', async () => setSettings(await window.timeEfficiency.updateSettings(patch)))
  return <section className="panel settings"><SettingRow title="登录 Windows 后自动启动" note="默认开启；你可以随时关闭。"><button className={`switch ${settings.launchAtLogin ? 'on' : ''}`} disabled={busy === 'settings'} onClick={() => update({ launchAtLogin: !settings.launchAtLogin })}><i /></button></SettingRow><SettingRow title="早间计划提醒" note="若当时关机，会在下次启动时补提醒。"><input type="time" value={settings.morningReminder} onChange={(event) => update({ morningReminder: event.target.value })} /></SettingRow><SettingRow title="晚间复盘提醒" note="初始固定时间；后续可根据个人规律调整。"><input type="time" value={settings.eveningReminder} onChange={(event) => update({ eveningReminder: event.target.value })} /></SettingRow><SettingRow title="AI 通道" note="使用本机已登录的 Codex CLI，不需要额外 API Key。"><span className="chip">Codex CLI</span></SettingRow></section>
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
