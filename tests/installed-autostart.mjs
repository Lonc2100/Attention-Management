import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright-core'

const root = resolve(import.meta.dirname, '..')
const artifacts = join(root, 'tests', '.artifacts')
const profile = join(artifacts, 'autostart-profile')
const executable = join(process.env.LOCALAPPDATA, 'Programs', 'time-efficiency-assistant', '时间效率助手.exe')
const runKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const valueName = 'electron.app.时间效率助手'
mkdirSync(profile, { recursive: true })

function queryValue() {
  try {
    return execFileSync('reg.exe', ['query', runKey, '/v', valueName], { encoding: 'utf8', windowsHide: true })
  } catch {
    return ''
  }
}

const electronApp = await electron.launch({
  executablePath: executable,
  args: ['--hidden', `--user-data-dir=${profile}`],
  timeout: 45_000
})

try {
  await electronApp.firstWindow({ timeout: 45_000 })
  const deadline = Date.now() + 45_000
  while (electronApp.windows().length < 2 && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const page = electronApp.windows().find((candidate) => !candidate.url().includes('window=widget'))
  assert.ok(page, 'installed main window was not created')
  page.setDefaultTimeout(30_000)
  await page.getByText('正在真实记录', { exact: true }).waitFor()
  await page.getByRole('button', { name: '设置' }).click()
  const toggle = page.locator('.switch').first()
  await toggle.click()
  await page.locator('.switch:not(.on)').waitFor()
  assert.equal(queryValue(), '', 'autostart registry value still exists after disabling')
  await toggle.click()
  await page.locator('.switch.on').waitFor()
  const enabled = queryValue()
  assert.match(enabled, /time-efficiency-assistant/i)
  assert.match(enabled, /--hidden/i)
  writeFileSync(join(artifacts, 'installed-autostart.json'), JSON.stringify({ ok: true, disabledRemovedValue: true, enabledValue: enabled.trim() }, null, 2), 'utf8')
  process.stdout.write('INSTALLED AUTOSTART PASS: setting removes and restores the Windows Run value\n')
} finally {
  await electronApp.close()
}
