import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { auditElectronBoundaries } from '../scripts/electron-harness-lint-lib.mjs'

const fixtureRoot = path.join(process.cwd(), 'tests', '.data', 'electron-harness-lint-fixture')

function write(relativePath, content) {
  const absolute = path.join(fixtureRoot, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content, 'utf8')
}

test('Electron Harness catches process and platform boundary violations', () => {
  write('src/shared/good.ts', 'export const good = true\n')
  write('src/shared/bad.ts', "import { readFileSync } from 'node:fs'\nexport { readFileSync }\n")
  write('src/main/secret.ts', 'export const secret = true\n')
  write('src/preload/bad.ts', "import { secret } from '../main/secret'\nexport { secret }\n")
  write('src/renderer/src/bad.ts', "import { secret } from '../../main/secret'\nexport const load = () => fetch('http://127.0.0.1:5600/api/0/info')\nexport { secret }\n")
  write('src/main/bad.ts', "import '../renderer/src/bad'\n")

  const errors = auditElectronBoundaries(fixtureRoot)
  const rules = new Set(errors.map((error) => error.rule))
  assert.ok(rules.has('shared-platform-free'))
  assert.ok(rules.has('preload-bridge-only'))
  assert.ok(rules.has('renderer-process-boundary'))
  assert.ok(rules.has('renderer-ipc-only'))
  assert.ok(rules.has('main-process-boundary'))
})

test('Electron Harness accepts the intended IPC route', () => {
  const cleanRoot = path.join(process.cwd(), 'tests', '.data', 'electron-harness-clean-fixture')
  const files = {
    'src/shared/contracts.ts': 'export interface Api { ping(): Promise<boolean> }\n',
    'src/main/providers/activitywatch.ts': "import type { Api } from '../../shared/contracts'\nexport const provider: Api = { ping: async () => true }\n",
    'src/main/services/activity.ts': "import { provider } from '../providers/activitywatch'\nexport const ping = () => provider.ping()\n",
    'src/main/runtime/activity.ts': "import { ping } from '../services/activity'\nexport const run = () => ping()\n",
    'src/preload/index.ts': "import { contextBridge } from 'electron'\nimport type { Api } from '../shared/contracts'\nexport const api = {} as Api\ncontextBridge.exposeInMainWorld('api', api)\n",
    'src/renderer/src/App.tsx': "import type { Api } from '../../shared/contracts'\nexport const App = (_props: { api: Api }) => null\n"
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = path.join(cleanRoot, relativePath)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content, 'utf8')
  }
  assert.deepEqual(auditElectronBoundaries(cleanRoot), [])
})
