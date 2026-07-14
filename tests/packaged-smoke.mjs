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
  const page = await electronApp.firstWindow({ timeout: 45_000 })
  page.setDefaultTimeout(30_000)
  await page.getByText('正在真实记录', { exact: true }).waitFor()
  await page.getByRole('button', { name: '诊断' }).click()
  await page.getByText('ActivityWatch 服务', { exact: true }).waitFor()
  const diagnostics = await page.locator('.diagnostics').innerText()
  assert.match(diagnostics, /v0\.13\.2/)
  assert.match(diagnostics, /Codex CLI/)
  writeFileSync(join(artifacts, 'packaged-smoke.json'), JSON.stringify({ ok: true, executable, diagnostics }, null, 2), 'utf8')
  process.stdout.write('PACKAGED SMOKE PASS: bundled ActivityWatch and diagnostics are available\n')
} finally {
  await electronApp.close()
}
