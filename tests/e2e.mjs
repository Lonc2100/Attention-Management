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
  await app.page.getByText('正在真实记录').waitFor()
  record('ActivityWatch UI status', 'connected and tracking')

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
  await app.page.getByRole('button', { name: '暂停采集' }).click()
  await app.page.getByText('采集已暂停', { exact: true }).waitFor()
  await new Promise((resolveWait) => setTimeout(resolveWait, 1200))
  const paused = processes()
  assert.ok(!/aw-watcher-window\.exe/i.test(paused), 'window watcher still running after pause')
  assert.ok(!/aw-watcher-afk\.exe/i.test(paused), 'AFK watcher still running after pause')
  record('Pause tracking', 'both bundled watcher processes stopped')

  await app.page.getByRole('button', { name: '恢复采集' }).click()
  await app.page.getByText('正在真实记录', { exact: true }).waitFor()
  await new Promise((resolveWait) => setTimeout(resolveWait, 1200))
  const resumed = processes()
  assert.match(resumed, /aw-watcher-window\.exe/i)
  assert.match(resumed, /aw-watcher-afk\.exe/i)
  record('Resume tracking', 'both bundled watcher processes restarted')

  await app.page.screenshot({ path: join(artifacts, 'e2e-dashboard.png'), fullPage: true })
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
