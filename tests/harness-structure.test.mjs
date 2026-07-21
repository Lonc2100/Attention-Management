import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => readFileSync(path.join(root, file), 'utf8')

test('Harness-lite keeps the real Electron process structure', () => {
  for (const directory of ['src/main', 'src/preload', 'src/renderer', 'src/shared']) {
    assert.equal(existsSync(path.join(root, directory)), true, `missing ${directory}`)
  }
  for (const file of ['ARCHITECTURE.md', 'harness-lite.json', 'docs/context/index.md', 'scripts/electron-harness-lint.mjs']) {
    assert.equal(existsSync(path.join(root, file)), true, `missing ${file}`)
  }
})

test('Electron windows and preload preserve the security boundary', () => {
  const main = read('src/main/index.ts')
  const preload = read('src/preload/index.ts')
  assert.match(main, /sandbox:\s*true/)
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(preload, /contextBridge\.exposeInMainWorld/)
  assert.match(preload, /from ['"]\.\.\/shared\/contracts['"]/)
})

test('package exposes one fast deterministic verification gate', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.scripts['lint:arch'], 'node scripts/electron-harness-lint.mjs')
  assert.match(packageJson.scripts['test:structure'], /harness-structure\.test\.mjs/)
  assert.match(packageJson.scripts['test:structure'], /electron-harness-lint\.test\.mjs/)
  assert.match(packageJson.scripts['verify:harness'], /context:check/)
  assert.match(packageJson.scripts.verify, /verify:harness/)
  assert.match(packageJson.scripts.verify, /typecheck/)
  assert.match(packageJson.scripts.verify, /test/)
  assert.match(packageJson.scripts.verify, /build/)
  assert.doesNotMatch(packageJson.scripts.verify, /test:e2e|dist|electron-builder/)
})

test('incremental adopter has no destructive or force mode', () => {
  const source = read('scripts/init-electron-harness-lite.mjs')
  assert.match(source, /--dry-run/)
  assert.match(source, /Refusing to overwrite/)
  assert.doesNotMatch(source, /--force|rmSync|unlinkSync|rmdirSync|Remove-Item/)
})

test('incremental adopter refuses conflicts before writing any Harness file', () => {
  const fixture = path.join(root, 'tests', '.data', 'electron-harness-adoption-conflict')
  for (const directory of ['src/main', 'src/preload', 'src/renderer', 'src/shared']) {
    mkdirSync(path.join(fixture, directory), { recursive: true })
  }
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({
    name: 'conflict-fixture',
    private: true,
    devDependencies: { electron: '1.0.0' },
    scripts: {}
  }, null, 2), 'utf8')
  writeFileSync(path.join(fixture, 'AGENTS.md'), '# Existing project rules\n', 'utf8')
  writeFileSync(path.join(fixture, 'ARCHITECTURE.md'), '# Existing incompatible architecture\n', 'utf8')

  const result = spawnSync(process.execPath, ['scripts/init-electron-harness-lite.mjs', '--target', fixture], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /Refusing to overwrite/)
  assert.equal(existsSync(path.join(fixture, 'harness-lite.json')), false)
  assert.equal(readFileSync(path.join(fixture, 'AGENTS.md'), 'utf8'), '# Existing project rules\n')
})

test('incremental adopter safely augments a non-empty Electron project', () => {
  const fixture = path.join(root, 'tests', '.data', 'electron-harness-adoption-clean')
  for (const directory of ['src/main', 'src/preload', 'src/renderer', 'src/shared']) {
    mkdirSync(path.join(fixture, directory), { recursive: true })
  }
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({
    name: 'clean-fixture',
    private: true,
    devDependencies: { electron: '1.0.0' },
    scripts: {}
  }, null, 2), 'utf8')
  writeFileSync(path.join(fixture, 'AGENTS.md'), '# Existing project rules\n', 'utf8')

  const result = spawnSync(process.execPath, ['scripts/init-electron-harness-lite.mjs', '--target', fixture], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(existsSync(path.join(fixture, 'harness-lite.json')), true)
  assert.match(readFileSync(path.join(fixture, 'AGENTS.md'), 'utf8'), /# Existing project rules[\s\S]*# Attention Management Harness-lite/)
  const packageJson = JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts.verify, 'npm run verify:harness && npm run typecheck && npm test && npm run build')
})
