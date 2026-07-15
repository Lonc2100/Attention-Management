import { execFileSync, spawn } from 'node:child_process'
import type { ActivitySummary, DailyRecord } from '../shared/contracts'
import { buildOutcomeEvidence } from '../shared/outcome-insights'
import { resolveCodexExecutable } from './codex-executable'

export async function codexDiagnostics(): Promise<{ ok: boolean; detail: string }> {
  try {
    const executable = resolveCodexExecutable()
    const version = execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim()
    const login = execFileSync(executable, ['login', 'status'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim()
    return { ok: /logged in/i.test(login), detail: `${version} · ${login}` }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

export function buildCodexReviewPayload(record: DailyRecord, activity: ActivitySummary) {
  const outcomes = buildOutcomeEvidence(record, activity).map((outcome) => ({
    title: outcome.title,
    priority: outcome.priority,
    status: outcome.status,
    projects: outcome.projectLabels,
    attentionMinutes: Math.round(outcome.attentionSeconds / 60)
  }))
  return {
    date: record.date,
    outcomes,
    subjectiveScore: record.review?.subjectiveScore ?? null,
    userSummary: record.review?.summary ?? '',
    tomorrowIntent: record.review?.tomorrowIntent ?? '',
    activeMinutes: Math.round(activity.activeSeconds / 60),
    afkMinutes: Math.round(activity.afkSeconds / 60),
    codexAttentionMinutes: Math.round(activity.codexActiveSeconds / 60),
    codexClassificationCoveragePercent: activity.codexCoveragePercent,
    projectUsage: activity.projects.map((project) => ({
      project: project.label,
      minutes: Math.round(project.seconds / 60),
      classified: project.classified
    })),
    appUsage: activity.apps.slice(0, 12).map((app) => ({ app: app.app, minutes: Math.round(app.seconds / 60) })),
    offlineNotes: record.afkNotes.map((note) => note.note).filter(Boolean)
  }
}

function buildPrompt(record: DailyRecord, activity: ActivitySummary): string {
  const payload = buildCodexReviewPayload(record, activity)
  return [
    '你是一个务实的个人效率复盘教练。根据下面经过脱敏和聚合的本机数据，用中文输出今日复盘。',
    '不要把离开电脑自动判定为低效；以重要成果完成情况为第一判断依据。',
    '固定输出四段：1. 结果判断；2. 时间证据；3. 一个最值得保留的模式；4. 明天唯一优先建议。',
    '控制在 350 字内，不虚构数据，不使用空泛鼓励。',
    JSON.stringify(payload, null, 2)
  ].join('\n\n')
}

export async function runCodexReview(record: DailyRecord, activity: ActivitySummary): Promise<string> {
  const executable = resolveCodexExecutable()
  const args = ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '-']
  const prompt = buildPrompt(record, activity)
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Codex CLI 分析超过 120 秒，已停止'))
    }, 120_000)
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`Codex CLI 失败（${code}）：${stderr.trim() || '无错误详情'}`))
        return
      }
      let answer = ''
      for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
        try {
          const event = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string }; message?: string }
          if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) answer = event.item.text
          if (event.type === 'agent_message' && event.message) answer = event.message
        } catch {
          // Ignore non-JSON diagnostics from the CLI.
        }
      }
      answer ? resolve(answer) : reject(new Error('Codex CLI 已结束，但没有返回可解析的回答'))
    })
    child.stdin.end(prompt, 'utf8')
  })
}
