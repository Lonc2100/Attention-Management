import { useEffect, useMemo, useState } from 'react'
import type { ActivityDetailEntry, ActivityDetails, ActivitySummary } from '../../shared/contracts'

type Filter = 'all' | ActivityDetailEntry['attribution']
type Mode = 'details' | 'rules'

const COLORS = ['#58c9d9', '#73dfb4', '#8aa8f5', '#ef9e6d', '#b889e9', '#e6759e', '#7ed7a0']
const SOURCE_LABEL: Record<ActivityDetailEntry['attribution'], string> = {
  manual: '人工纠错', rule: '规则', 'codex-context': 'Codex确认', application: '应用', unclassified: '待分类', afk: '离开电脑'
}

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (seconds > 0 && minutes === 0) return '<1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function shiftDate(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + delta)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function colorFor(entry: ActivityDetailEntry): string {
  if (entry.attribution === 'afk') return '#46535d'
  const key = entry.projectKey ?? `app:${entry.app.toLocaleLowerCase()}`
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length] ?? COLORS[0]
}

export function ActivityDetailsView({ initialDate, onActivity }: { initialDate: string; onActivity: (activity: ActivitySummary) => void }) {
  const [date, setDate] = useState(initialDate)
  const [details, setDetails] = useState<ActivityDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('details')
  const [editingBoundary, setEditingBoundary] = useState(false)
  const [boundaryTime, setBoundaryTime] = useState('09:00')

  const load = async (target = date) => {
    setLoading(true)
    setError('')
    try {
      const next = await window.timeEfficiency.getActivityDetails(target)
      setDetails(next)
      if (next.workday) setBoundaryTime(new Date(next.workday.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      setSelectedId((current) => next.entries.some((entry) => entry.id === current) ? current : null)
      if (!next.connected && next.error) setError(next.error)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(date) }, [date])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (details?.entries ?? []).filter((entry) => {
      if (filter !== 'all' && entry.attribution !== filter) return false
      return !query || `${entry.app} ${entry.title} ${entry.projectLabel}`.toLocaleLowerCase().includes(query)
    }).sort((a, b) => Date.parse(b.end) - Date.parse(a.end) || b.id.localeCompare(a.id))
  }, [details, filter, search])
  const selected = details?.entries.find((entry) => entry.id === selectedId) ?? null
  const rangeStart = details?.rangeStart ? Date.parse(details.rangeStart) : 0
  const rangeEnd = details?.rangeEnd ? Date.parse(details.rangeEnd) : 0
  const range = Math.max(1, rangeEnd - rangeStart)

  const mutate = async (action: () => Promise<ActivityDetails>, message: string) => {
    setError('')
    try {
      const next = await action()
      setDetails(next)
      setToast(message)
      if (date === initialDate) onActivity(await window.timeEfficiency.refreshActivity(date))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const saveBoundary = () => {
    const startsAt = new Date(`${date}T${boundaryTime}:00`).toISOString()
    return mutate(() => window.timeEfficiency.setWorkdayBoundary({ date, startsAt }), '工作日边界已更新').then(() => setEditingBoundary(false))
  }

  return <div className="activity-workspace">
    <section className="activity-main">
      <div className="activity-toolbar">
        <div className="activity-date-nav"><button className="icon-button" onClick={() => setDate(shiftDate(date, -1))}>‹</button><input aria-label="活动日期" type="date" value={date} max={initialDate} onChange={(event) => setDate(event.target.value)} /><button className="icon-button" disabled={date >= initialDate} onClick={() => setDate(shiftDate(date, 1))}>›</button>{date !== initialDate && <button className="text-button" onClick={() => setDate(initialDate)}>回到今天</button>}</div>
        <div className="activity-view-switch"><button className={mode === 'details' ? 'active' : ''} onClick={() => setMode('details')}>活动明细</button><button className={mode === 'rules' ? 'active' : ''} onClick={() => setMode('rules')}>归类规则 {details?.rules.length ? `· ${details.rules.length}` : ''}</button></div>
      </div>

      {toast && <div className="activity-toast">✓ {toast}</div>}
      {error && <div className="activity-state activity-state--error"><strong>读取或保存未完成</strong><span>{error}</span><button className="secondary" onClick={() => void load()}>重新读取</button></div>}
      {details?.warning && <div className="activity-warning">! {details.warning}</div>}
      {details?.workday && <div className="workday-boundary-bar"><div><span>工作日从</span><strong>{clock(details.workday.startsAt)}</strong><small>{details.workday.source === 'manual' ? '人工确认' : details.workday.source === 'auto' ? '主要休息后自动开始' : '首个可用活动'}</small></div>{editingBoundary ? <div className="workday-boundary-editor"><input aria-label="工作日开始时间" type="time" value={boundaryTime} onChange={(event) => setBoundaryTime(event.target.value)} /><button className="primary" onClick={() => void saveBoundary()}>保存</button><button className="secondary" onClick={() => setEditingBoundary(false)}>取消</button></div> : <div><button className="secondary" onClick={() => setEditingBoundary(true)}>调整边界</button>{details.workday.source === 'manual' && <button className="text-button" onClick={() => void mutate(() => window.timeEfficiency.removeWorkdayBoundary({ date }), '已恢复自动判断')}>恢复自动</button>}</div>}</div>}

      {mode === 'details' && <>
        <section className="activity-timeline-card">
          <div className="activity-section-head"><div><p className="eyebrow">RECORDED RANGE</p><h2>{details?.rangeStart ? `${clock(details.rangeStart)}–${clock(details.rangeEnd ?? details.rangeStart)}` : '当天记录区间'}</h2></div><div><strong>{duration(details?.activeSeconds ?? 0)}</strong><small>有效电脑时间</small></div></div>
          {loading ? <div className="activity-skeleton"><i /><i /><i /></div> : details?.entries.length ? <>
            <div className="activity-track" aria-label="活动时间线">{details.entries.map((entry) => <button key={entry.id} className={`activity-track-segment source-${entry.attribution} ${selectedId === entry.id ? 'selected' : ''}`} style={{ left: `${((Date.parse(entry.start) - rangeStart) / range) * 100}%`, width: `${Math.max(.32, ((Date.parse(entry.end) - Date.parse(entry.start)) / range) * 100)}%`, background: colorFor(entry) }} title={`${clock(entry.start)}–${clock(entry.end)} · ${entry.projectLabel}\n${entry.title}`} onClick={() => setSelectedId(entry.id)} />)}</div>
            <div className="activity-ticks"><span>{clock(details.rangeStart ?? '')}</span><span>{clock(new Date(rangeStart + range * .25).toISOString())}</span><span>{clock(new Date(rangeStart + range * .5).toISOString())}</span><span>{clock(new Date(rangeStart + range * .75).toISOString())}</span><span>{clock(details.rangeEnd ?? '')}</span></div>
          </> : <div className="activity-empty">这一天还没有电脑活动记录。<small>可切换日期，或到“诊断”检查 ActivityWatch。</small></div>}
        </section>

        <section className="activity-list-card">
          <div className="activity-list-tools"><div className="activity-filters">{(['all', 'manual', 'rule', 'codex-context', 'unclassified', 'application', 'afk'] as Filter[]).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? '全部' : SOURCE_LABEL[value]}</button>)}</div><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索应用、标题或项目" /></div>
          <div className="activity-list-head"><span>时间</span><span>活动证据</span><span>当前归类</span><span>来源</span></div>
          {loading ? <div className="activity-skeleton rows"><i /><i /><i /><i /></div> : filtered.length ? <div className="activity-list">{filtered.map((entry) => <button key={entry.id} data-end={entry.end} className={selectedId === entry.id ? 'selected' : ''} onClick={() => setSelectedId(entry.id)}><time>{clock(entry.start)}–{clock(entry.end)}</time><span className="activity-evidence"><i style={{ background: colorFor(entry) }}>{entry.attribution === 'afk' ? 'Z' : entry.app.slice(0, 1).toUpperCase()}</i><span><strong title={entry.title}>{entry.title}</strong><small>{entry.attribution === 'afk' ? duration(entry.seconds) : `${entry.app} · ${duration(entry.seconds)}`}</small></span></span><strong className="activity-project">{entry.projectLabel}</strong><em className={`source-badge source-${entry.attribution}`}>{SOURCE_LABEL[entry.attribution]}</em></button>)}</div> : <div className="activity-empty">没有符合当前筛选的活动。<button className="text-button" onClick={() => { setFilter('all'); setSearch('') }}>清除筛选</button></div>}
        </section>
      </>}

      {mode === 'rules' && <RuleManager details={details} mutate={mutate} />}
    </section>
    {mode === 'details' && <EvidenceDrawer entry={selected} details={details} onClose={() => setSelectedId(null)} mutate={mutate} />}
  </div>
}

function EvidenceDrawer({ entry, details, onClose, mutate }: {
  entry: ActivityDetailEntry | null
  details: ActivityDetails | null
  onClose: () => void
  mutate: (action: () => Promise<ActivityDetails>, message: string) => Promise<void>
}) {
  const [projectKey, setProjectKey] = useState('')
  const [newProject, setNewProject] = useState('')
  const [learnRule, setLearnRule] = useState(false)
  const [titleMatch, setTitleMatch] = useState<'contains' | 'exact'>('contains')
  const [pattern, setPattern] = useState('')
  useEffect(() => {
    setProjectKey(entry?.projectKey ?? '')
    setNewProject('')
    setLearnRule(false)
    setTitleMatch('contains')
    setPattern(entry?.title ?? '')
  }, [entry?.id])
  if (!entry) return <aside className="evidence-drawer evidence-drawer--empty"><div><span>↖</span><h2>选择一段活动</h2><p>点击时间线或明细行，查看它为何被归到当前项目，并在需要时纠正。</p></div></aside>
  const meaningful = pattern.trim().replace(/\s+/g, ' ').length >= 4
  const save = () => mutate(() => window.timeEfficiency.saveActivityCorrection({
    date: details?.date ?? '', entryId: entry.id, start: entry.start, end: entry.end, app: entry.app, title: entry.title,
    projectKey, projectLabel: projectKey === '__new__' ? newProject : undefined, learnRule: learnRule && meaningful, titleMatch, titlePattern: pattern
  }), learnRule && meaningful ? '纠错已保存，规则从现在开始学习' : '本段活动已纠正')
  return <aside className="evidence-drawer"><button className="drawer-close" onClick={onClose}>×</button><p className="eyebrow">SELECTED EVIDENCE</p><h2>这 {duration(entry.seconds)} 在做什么？</h2><div className="evidence-card"><label>时间<strong>{clock(entry.start)}–{clock(entry.end)}</strong></label><label>应用<strong>{entry.app}</strong></label><label>窗口标题<strong>{entry.title}</strong></label><label>当前归类<strong>{entry.projectLabel}</strong></label><label>判断来源<strong>{SOURCE_LABEL[entry.attribution]}{entry.attribution === 'manual' ? ' · 最高优先级' : ''}</strong></label></div>{entry.correctable && <div className="correction-form"><label><span>归入项目</span><select value={projectKey} onChange={(event) => setProjectKey(event.target.value)}><option value="">请选择项目</option>{details?.projectOptions.map((project) => <option key={project.key} value={project.key}>{project.label}</option>)}<option value="__new__">＋ 新建项目</option></select></label>{projectKey === '__new__' && <label><span>新项目名称</span><input autoFocus maxLength={60} value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="例如：自媒体创作" /></label>}<label className="learn-check"><input type="checkbox" checked={learnRule} onChange={(event) => setLearnRule(event.target.checked)} /><span>以后同类活动自动归类<small>新规则只影响保存之后，不改写过去。</small></span></label>{learnRule && <div className="rule-editor"><select value={titleMatch} onChange={(event) => setTitleMatch(event.target.value as 'contains' | 'exact')}><option value="contains">标题包含</option><option value="exact">标题完全等于</option></select><input value={pattern} onChange={(event) => setPattern(event.target.value)} />{!meaningful && <small>标题条件至少 4 个字符；本次仍可只保存人工纠错。</small>}</div>}<button className="primary full" disabled={!projectKey || (projectKey === '__new__' && !newProject.trim())} onClick={() => void save()}>保存纠错</button>{entry.overrideId && <button className="text-button undo" onClick={() => void mutate(() => window.timeEfficiency.removeActivityCorrection({ date: details?.date ?? '', overrideId: entry.overrideId ?? '' }), '已撤销人工纠错')}>撤销这次纠错</button>}</div>}</aside>
}

function RuleManager({ details, mutate }: { details: ActivityDetails | null; mutate: (action: () => Promise<ActivityDetails>, message: string) => Promise<void> }) {
  if (!details?.rules.length) return <section className="rule-manager"><div className="activity-empty"><strong>还没有归类规则</strong><small>在活动明细中纠正一段时间，并勾选“以后同类活动自动归类”。</small></div></section>
  return <section className="rule-manager"><div className="activity-section-head"><div><p className="eyebrow">FIRST MATCH WINS</p><h2>归类规则</h2><p>从上到下匹配，第一条命中生效；规则只影响各自创建之后的活动。</p></div></div><div className="rule-list">{details.rules.map((rule, index) => {
    const project = details.projectOptions.find((item) => item.key === rule.projectKey)
    const covered = details.rules.slice(0, index).some((candidate) => candidate.enabled && candidate.app.toLocaleLowerCase() === rule.app.toLocaleLowerCase() && candidate.titleMatch === rule.titleMatch && candidate.titlePattern.toLocaleLowerCase() === rule.titlePattern.toLocaleLowerCase())
    return <article key={rule.id} className={!rule.enabled ? 'disabled' : ''}><span className="rule-priority">{index + 1}</span><div><strong>{rule.app} · 标题{rule.titleMatch === 'contains' ? '包含' : '等于'} “{rule.titlePattern}”</strong><small>→ {project?.label ?? rule.projectKey} · 从 {new Date(rule.appliesFrom).toLocaleString('zh-CN')} 开始</small>{covered && <em>被更高优先级的相同条件遮挡</em>}</div><div className="rule-actions"><button title="上移" disabled={index === 0} onClick={() => void mutate(() => window.timeEfficiency.moveActivityRule({ date: details.date, ruleId: rule.id, direction: 'up' }), '规则优先级已更新')}>↑</button><button title="下移" disabled={index === details.rules.length - 1} onClick={() => void mutate(() => window.timeEfficiency.moveActivityRule({ date: details.date, ruleId: rule.id, direction: 'down' }), '规则优先级已更新')}>↓</button><button onClick={() => void mutate(() => window.timeEfficiency.setActivityRuleEnabled({ date: details.date, ruleId: rule.id, enabled: !rule.enabled }), rule.enabled ? '规则已停用' : '规则已启用')}>{rule.enabled ? '停用' : '启用'}</button><button className="danger-text" onClick={() => void mutate(() => window.timeEfficiency.removeActivityRule({ date: details.date, ruleId: rule.id }), '规则已删除')}>删除</button></div></article>
  })}</div></section>
}
