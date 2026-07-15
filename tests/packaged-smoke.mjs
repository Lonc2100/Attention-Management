import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright-core'

const root = resolve(import.meta.dirname, '..')
const artifacts = join(root, 'tests', '.artifacts')
const profile = join(artifacts, 'packaged-profile')
const executable = join(root, 'release', 'win-unpacked', '时间效率助手.exe')
mkdirSync(profile, { recursive: true })

const electronApp = await electron.launch({
  executablePath: executable,
  args: [`--user-data-dir=${profile}`],
  env: { ...process.env, TIME_EFFICIENCY_E2E: '1' },
  timeout: 45_000
})

try {
  await electronApp.firstWindow({ timeout: 45_000 })
  const deadline = Date.now() + 45_000
  while (electronApp.windows().length < 2 && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const page = electronApp.windows().find((candidate) => !candidate.url().includes('window=widget'))
  assert.ok(page, 'packaged main window was not created')
  page.setDefaultTimeout(30_000)
  await page.getByText('正在真实记录', { exact: true }).waitFor()
  await page.getByRole('button', { name: '诊断' }).click()
  await page.getByText('ActivityWatch 服务', { exact: true }).waitFor()
  const diagnostics = await page.locator('.diagnostics').innerText()
  assert.match(diagnostics, /v0\.13\.2/)
  assert.match(diagnostics, /Codex CLI/)
  assert.match(diagnostics, /Codex 项目识别/)
  writeFileSync(join(artifacts, 'packaged-smoke.json'), JSON.stringify({ ok: true, executable, diagnostics }, null, 2), 'utf8')
  process.stdout.write('PACKAGED SMOKE PASS: bundled ActivityWatch and diagnostics are available\n')
} finally {
  await electronApp.close()
}
