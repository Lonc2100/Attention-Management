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
  await electronApp.firstWindow({ timeout: 30_000 })
  const deadline = Date.now() + 30_000
  while (electronApp.windows().length < 2 && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const windows = electronApp.windows()
  const page = windows.find((candidate) => !candidate.url().includes('window=widget'))
  const widget = windows.find((candidate) => candidate.url().includes('window=widget'))
  assert.ok(page, 'main window was not created')
  assert.ok(widget, 'floating widget window was not created')
  page.setDefaultTimeout(30_000)
  widget.setDefaultTimeout(30_000)
  return { electronApp, page, widget }
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
  await app.page.getByTestId('attention-overview').waitFor()
  await app.page.getByTestId('attention-timeline').waitFor()
  await app.page.getByTestId('focus-strip').waitFor()
  for (const [width, height] of [[1440, 900], [1600, 1000]]) {
    await app.electronApp.evaluate(({ BrowserWindow }, size) => {
      const main = BrowserWindow.getAllWindows().find((item) => !item.webContents.getURL().includes('window=widget'))
      main?.setBounds({ x: 40, y: 40, width: size.width, height: size.height })
    }, { width, height })
    await app.page.waitForTimeout(200)
    const noHorizontalOverflow = await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    assert.equal(noHorizontalOverflow, true, `dashboard overflowed horizontally at ${width}x${height}`)
    const timelineBox = await app.page.getByTestId('attention-timeline').boundingBox()
    assert.ok(timelineBox && timelineBox.y + timelineBox.height <= height, `timeline was not fully visible at ${width}x${height}`)
    await app.page.mouse.move(350, 40)
    await app.page.screenshot({ path: join(artifacts, `e2e-attention-dashboard-${width}x${height}.png`), fullPage: false, timeout: 30_000 })
  }
  const donutTarget = app.page.locator('[data-chart-target="donut"]').first()
  if (await donutTarget.count()) {
    const donutBox = await donutTarget.boundingBox()
    assert.ok(donutBox, 'donut target did not expose a visible hit area')
    const donutSvgBox = await app.page.locator('svg[aria-label="今日注意力分布"]').boundingBox()
    const dashArray = (await donutTarget.getAttribute('stroke-dasharray'))?.split(' ').map(Number)
    assert.ok(donutSvgBox && dashArray && dashArray.length === 2, 'donut geometry was unavailable')
    const arcFraction = dashArray[0] / dashArray[1]
    const angle = -Math.PI / 2 + arcFraction * Math.PI
    const radius = Math.min(donutSvgBox.width, donutSvgBox.height) * 70 / 180
    await app.page.mouse.move(donutSvgBox.x + donutSvgBox.width / 2 + Math.cos(angle) * radius, donutSvgBox.y + donutSvgBox.height / 2 + Math.sin(angle) * radius)
    await app.page.getByTestId('attention-tooltip').waitFor()
    const activeKey = await donutTarget.getAttribute('data-category-key')
    assert.ok(activeKey, 'donut target did not expose a category key')
    assert.ok(await app.page.locator(`[data-category-key="${activeKey}"][data-linked-active="true"]`).count() >= 2, 'donut hover did not link chart elements')
    const timelineSegments = app.page.locator('.timeline-segment')
    let widestSegment = null
    for (let index = 0; index < await timelineSegments.count(); index += 1) {
      const candidate = timelineSegments.nth(index)
      const box = await candidate.boundingBox()
      if (box && (!widestSegment || box.width > widestSegment.box.width)) widestSegment = { candidate, box }
    }
    assert.ok(widestSegment, 'timeline did not expose an interactive segment')
    await app.page.mouse.move(widestSegment.box.x + widestSegment.box.width / 2, widestSegment.box.y + widestSegment.box.height / 2)
    await app.page.getByTestId('attention-tooltip').waitFor()
    const timelineKey = await widestSegment.candidate.getAttribute('data-category-key')
    assert.ok(timelineKey && await app.page.locator(`[data-category-key="${timelineKey}"][data-linked-active="true"]`).count() >= 2, 'timeline hover did not link chart elements')
  } else {
    assert.fail('interactive donut targets were not rendered')
  }
  record('Attention dashboard', 'unified attention overview, chronological timeline and truthful focus state rendered')

  await app.widget.getByTestId('floating-widget').waitFor()
  if (!await app.widget.getByText('电脑活跃', { exact: true }).isVisible()) {
    await app.widget.getByRole('button', { name: '展开悬浮窗' }).click()
  }
  await app.widget.getByText('电脑活跃', { exact: true }).waitFor()
  await app.widget.screenshot({ path: join(artifacts, 'e2e-widget-expanded.png'), timeout: 30_000 })
  record('Floating widget', 'widget rendered independently and expanded without opening the main window')
  await app.widget.getByRole('button', { name: '隐藏' }).click()
  const widgetHidden = await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('window=widget'))?.isVisible() === false)
  assert.equal(widgetHidden, true, 'widget did not hide')
  await app.page.getByRole('button', { name: '设置' }).click()
  await app.page.getByRole('button', { name: '显示悬浮窗' }).click()
  const widgetVisible = await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('window=widget'))?.isVisible() === true)
  assert.equal(widgetVisible, true, 'widget did not reopen from settings')
  const widgetDidNotStealFocus = await app.electronApp.evaluate(({ BrowserWindow }) => !BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('window=widget'))
  assert.equal(widgetDidNotStealFocus, true, 'showing the widget stole focus from the active work window')
  await app.page.getByLabel('悬浮方式').selectOption('desktop')
  const desktopMode = await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('window=widget'))?.isAlwaysOnTop() === false)
  assert.equal(desktopMode, true, 'desktop widget mode did not disable always-on-top')
  await app.page.getByLabel('悬浮方式').selectOption('always-on-top')
  const topMode = await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('window=widget'))?.isAlwaysOnTop() === true)
  assert.equal(topMode, true, 'always-on-top widget mode was not restored')
  record('Floating widget lifecycle', 'hide, reopen, desktop mode and always-on-top mode worked')

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

  await app.page.getByRole('button', { name: '设置' }).click()
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
  await app.page.getByRole('button', { name: /^早间计划/ }).click()
  const persistedOutcome = app.page.locator('.outcome-input input:last-child').nth(0)
  await persistedOutcome.waitFor()
  assert.equal(await persistedOutcome.inputValue(), '交付真实时间效率闭环')
  await app.page.getByRole('button', { name: /^晚间复盘/ }).click()
  assert.equal(await app.page.locator('textarea').inputValue(), '完成了真实采集、持久化和界面链路。')
  record('Restart persistence', 'morning plan and evening review survived app restart')
} finally {
  await app.electronApp.close()
}

writeFileSync(join(artifacts, 'e2e-results.json'), JSON.stringify({ passed: results.length, results }, null, 2), 'utf8')
process.stdout.write(`E2E COMPLETE: ${results.length} checks passed\n`)
