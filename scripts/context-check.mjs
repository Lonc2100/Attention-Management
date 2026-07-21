import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []
const required = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'harness-lite.json',
  '.trellis/workflow.md',
  'docs/context/index.md',
  'docs/context/current-state.md',
  'docs/context/engineering-principles.md',
  'docs/context/decisions.md'
]

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

for (const file of required) {
  if (!existsSync(path.join(root, file))) errors.push(`Missing context file: ${file}`)
}

if (errors.length === 0) {
  const agents = read('AGENTS.md')
  const architecture = read('ARCHITECTURE.md')
  const index = read('docs/context/index.md')
  const principles = read('docs/context/engineering-principles.md')
  const packageJson = JSON.parse(read('package.json'))
  const manifest = JSON.parse(read('harness-lite.json'))

  for (const token of ['docs/context/index.md', 'ARCHITECTURE.md', 'npm run verify', 'Trellis is the source of truth']) {
    if (!agents.includes(token)) errors.push(`AGENTS.md must include: ${token}`)
  }
  for (const token of ['ActivityWatch', 'Electron Runtime / IPC', 'Preload Bridge', 'Renderer UI']) {
    if (!architecture.includes(token)) errors.push(`ARCHITECTURE.md must include: ${token}`)
  }
  if (!index.includes('Trellis remains the only source of truth')) errors.push('Context index must keep Trellis as the product/task source of truth')
  if (!principles.includes('Shared Types / Pure Rules')) errors.push('Engineering principles must define the fixed route')
  for (const script of manifest.requiredScripts ?? []) {
    if (!packageJson.scripts?.[script]) errors.push(`package.json is missing Harness script: ${script}`)
  }
}

if (errors.length > 0) {
  console.error('context-check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('context-check passed')
