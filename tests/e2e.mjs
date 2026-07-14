import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright-core'

const root = resolve(import.meta.dirname, '..')
const artifacts = join(root, 'tests', '.artifacts')
const profile = join(artifacts, 'e2e-profile')
const executable = join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
mkdirSync(profile, { recursive: true })

const results = []
const record = (name, detail) => {
  results.push({ name, ok: true, detail })
  process.stdout.write(`PASS ${name}: ${detail}\n`)
}

function processes() {
  return execFileSync('tasklist.exe', ['/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true })
}

function processCount(snapshot, name) {
  return snapshot.split(/\r?\n/).filter((line) => line.toLowerCase().includes(`"${name.toLowerCase()}"`)).length
}

async function launch() {
  const electronApp = await electron.launch({
    executablePath: executable,
    args: ['.', `--user-data-dir=${profile}`],
    cwd: root,
    env: { ...process.env, TIME_EFFICIENCY_E2E: '1' },
    timeout: 30_000
  })
  const page = await electronApp.firstWindow({ timeout: 30_000 })
  page.setDefaultTimeout(30_000)
  return { electronApp, page }
}

let app = await launch()
try {
  const runningStatus = app.page.getByText('正在真实记录', { exact: true })
  const pausedStatus = app.page.getByText('采集已暂停', { exact: true })
  await Promise.race([runningStatus.waitFor(), pausedStatus.waitFor()])
  if (await pausedStatus.isVisible()) {
    await app.page.getByRole('button', { name: '恢复采集' }).click()
    await runningStatus.waitFor()
  }
  record('ActivityWatch UI status', 'connected and tracking')
  await app.page.getByText('项目注意力', { exact: true }).waitFor()
  await app.page.getByText(/等待确认 Codex 上下文|正在计入：|最近确认：/).waitFor()
  record('Automatic Codex context UI', 'context banner and project attention panel rendered without a manual switch')

  await app.page.getByRole('button', { name: /^早间计划/ }).click()
  const inputs = app.page.locator('.outcome-input input:last-child')
  await inputs.nth(0).fill('交付真实时间效率闭环')
  await inputs.nth(1).fill('验证 ActivityWatch 真实采集')
  await app.page.locator('.outcome-input input[type="radio"]').nth(0).check()
  await app.page.getByRole('button', { name: /确认，开始今天|更新今日计划/ }).click()
  await app.page.getByRole('button', { name: /更新今日计划/ }).waitFor()
  record('Morning plan', 'saved 2 outcomes and one absolute priority')

  await app.page.getByRole('button', { name: /^晚间复盘/ }).click()
  await app.page.locator('.review-outcomes select').nth(0).selectOption('done')
  await app.page.locator('.review-outcomes select').nth(1).selectOption('partial')
  await app.page.locator('textarea').fill('完成了真实采集、持久化和界面链路。')
  await app.page.locator('.field.block input').fill('继续完成安装包与启动验收。')
  await app.page.getByRole('button', { name: '保存今日复盘' }).click()
  record('Evening review', 'saved result statuses, summary and tomorrow intent')

  await app.page.getByRole('button', { name: /调用 Codex 生成复盘|重新分析/ }).click()
  await app.page.locator('.ai-answer').waitFor({ timeout: 130_000 })
  const aiText = (await app.page.locator('.ai-answer').innerText()).trim()
  assert.ok(aiText.length > 20, 'AI answer was unexpectedly short')
  record('Codex CLI UI path', `${aiText.length} Chinese characters returned and rendered`)

  await app.page.getByRole('button', { name: '今日概览' }).click()
  const beforePause = processes()
  await app.page.getByRole('button', { name: '暂停采集' }).click()
  await app.page.getByText('采集已暂停', { exact: true }).waitFor()
  await new Promise((resolveWait) => setTimeout(resolveWait, 1200))
  const paused = processes()
  assert.ok(processCount(paused, 'aw-watcher-window.exe') < processCount(beforePause, 'aw-watcher-window.exe'), 'test-owned window watcher did not stop after pause')
  assert.ok(processCount(paused, 'aw-watcher-afk.exe') < processCount(beforePause, 'aw-watcher-afk.exe'), 'test-owned AFK watcher did not stop after pause')
  record('Pause tracking', 'the test-owned watcher process counts decreased')

  await app.page.getByRole('button', { name: '恢复采集' }).click()
  await app.page.getByText('正在真实记录', { exact: true }).waitFor()
  await new Promise((resolveWait) => setTimeout(resolveWait, 1200))
  const resumed = processes()
  assert.ok(processCount(resumed, 'aw-watcher-window.exe') > processCount(paused, 'aw-watcher-window.exe'))
  assert.ok(processCount(resumed, 'aw-watcher-afk.exe') > processCount(paused, 'aw-watcher-afk.exe'))
  record('Resume tracking', 'the test-owned watcher process counts recovered')

  await app.page.getByRole('button', { name: '诊断' }).click()
  await app.page.getByText('Codex 项目识别', { exact: true }).waitFor()
  record('Codex context diagnostics', 'official app-server context source is visible in diagnostics')

  try {
    await app.page.screenshot({ path: join(artifacts, 'e2e-dashboard.png'), fullPage: false, timeout: 15_000 })
  } catch (error) {
    process.stdout.write(`WARN screenshot artifact was not captured: ${error instanceof Error ? error.message : String(error)}\n`)
  }
} finally {
  await app.electronApp.close()
}

await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
app = await launch()
try {
  await app.page.getByText('交付真实时间效率闭环').waitFor()
  await app.page.getByRole('button', { name: /^晚间复盘/ }).click()
  assert.equal(await app.page.locator('textarea').inputValue(), '完成了真实采集、持久化和界面链路。')
  record('Restart persistence', 'morning plan and evening review survived app restart')
} finally {
  await app.electronApp.close()
}

writeFileSync(join(artifacts, 'e2e-results.json'), JSON.stringify({ passed: results.length, results }, null, 2), 'utf8')
process.stdout.write(`E2E COMPLETE: ${results.length} checks passed\n`)
