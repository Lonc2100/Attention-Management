import { useEffect, useMemo, useState } from 'react'
import type { PersonalInsights } from '../../shared/contracts'

type Range = 7 | 14 | 30

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (seconds > 0 && minutes === 0) return '<1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  return parsed.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
}

function statusLabel(status: PersonalInsights['days'][number]['priorityStatus']): string {
  if (!status) return '未复盘'
  return { pending: '未确认', done: '完成', partial: '部分完成', dropped: '放弃' }[status]
}

export function InsightsView() {
  const [range, setRange] = useState<Range>(7)
  const [data, setData] = useState<PersonalInsights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void window.timeEfficiency.getInsights(range).then((next) => {
      if (active) setData(next)
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [range])

  const maxHour = useMemo(() => Math.max(1, ...(data?.candidateHours.map((hour) => hour.seconds) ?? [])), [data])

  return <div className="insights-page" data-testid="personal-insights">
    <section className="panel insights-hero">
      <div><p className="eyebrow">PERSONAL PATTERNS</p><h2>结果和注意力放在一起看</h2><p>这里只展示事实与相关性，不用单一时长给你打“效率分”。</p></div>
      <div className="range-switch" aria-label="规律时间范围">{([7, 14, 30] as Range[]).map((days) => <button key={days} className={range === days ? 'active' : ''} onClick={() => setRange(days)}>近 {days} 天</button>)}</div>
    </section>

    {loading && <section className="panel insights-state">正在读取本机历史记录…</section>}
    {error && <section className="panel insights-state error">无法生成个人规律：{error}</section>}
    {!loading && !error && data && <>
      <section className="insight-metrics">
        <article className="panel"><span>已复盘天数</span><strong>{data.reviewedDays}</strong><small>近 {data.requestedDays} 天</small></article>
        <article className="panel"><span>有采集数据</span><strong>{data.connectedDays}</strong><small>不把断连当作零效率</small></article>
        <article className="panel"><span>规律可信度</span><strong>{data.quality === 'ready' ? '可参考' : data.quality === 'partial' ? '部分数据' : '样本不足'}</strong><small>至少需要 3 个成果完成、评分 ≥4 且有项目证据的复盘日</small></article>
      </section>

      <section className="insights-grid">
        <article className="panel hour-patterns">
          <div className="panel-head"><div><p className="eyebrow">HIGH-QUALITY HOURS</p><h2>重要成果更常推进的时段</h2></div></div>
          {data.candidateHours.length ? <div className="hour-bars">{data.candidateHours.map((hour) => <div key={hour.hour}><time>{String(hour.hour).padStart(2, '0')}:00–{String((hour.hour + 1) % 24).padStart(2, '0')}:00</time><span><i style={{ width: `${Math.max(8, (hour.seconds / maxHour) * 100)}%` }} /></span><strong>{duration(hour.seconds)}</strong><small>{hour.qualifyingDays} 天出现</small></div>)}</div> : <div className="insights-empty"><strong>先积累 3 个高质量复盘日</strong><p>当天绝对优先成果完成、主观评分不低于 4，且有已关联项目注意力，才进入候选样本。</p></div>}
          <div className="insight-notes">{data.observations.map((note) => <p key={note}>· {note}</p>)}</div>
        </article>

        <article className="panel insight-days">
          <div className="panel-head"><div><p className="eyebrow">DAILY EVIDENCE</p><h2>逐日证据</h2></div></div>
          <div className="insight-day-list"><div className="insight-day-head"><span>日期</span><span>电脑活跃</span><span>优先成果注意力</span><span>结果 / 评分</span><span>切换</span></div>{[...data.days].reverse().map((day) => <div key={day.date} className={!day.connected ? 'muted-day' : ''}><strong>{dayLabel(day.date)}</strong><span>{day.connected ? duration(day.activeSeconds) : '无采集'}</span><span>{duration(day.priorityAttentionSeconds)}</span><span>{statusLabel(day.priorityStatus)}{day.subjectiveScore ? ` · ${day.subjectiveScore}/5` : ''}</span><span>{day.contextSwitches}</span></div>)}</div>
        </article>
      </section>
    </>}
  </div>
}
