import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const harnessFiles = [
  'ARCHITECTURE.md',
  'harness-lite.json',
  'docs/context/index.md',
  'docs/context/current-state.md',
  'docs/context/engineering-principles.md',
  'docs/context/decisions.md',
  'scripts/init-electron-harness-lite.mjs',
  'scripts/electron-harness-lint-lib.mjs',
  'scripts/electron-harness-lint.mjs',
  'scripts/context-check.mjs',
  'tests/electron-harness-lint.test.mjs',
  'tests/harness-structure.test.mjs'
]
const agentsMarker = '# Attention Management Harness-lite'
const harnessScripts = {
  'init:electron-harness-lite': 'node scripts/init-electron-harness-lite.mjs',
  'context:check': 'node scripts/context-check.mjs',
  'lint:arch': 'node scripts/electron-harness-lint.mjs',
  'test:structure': 'node --test tests/harness-structure.test.mjs tests/electron-harness-lint.test.mjs',
  'verify:harness': 'npm run context:check && npm run lint:arch && npm run test:structure',
  verify: 'npm run verify:harness && npm run typecheck && npm test && npm run build'
}

function parseArgs(argv) {
  const args = { dryRun: false, target: sourceRoot }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--dry-run') args.dryRun = true
    else if (item === '--target') args.target = path.resolve(argv[++index] ?? '')
    else throw new Error(`Unknown argument: ${item}`)
  }
  return args
}

function read(relativePath, root = sourceRoot) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function inspectTarget(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json')
  if (!existsSync(packagePath)) throw new Error(`Target is not an existing Node project: ${targetRoot}`)
  for (const directory of ['src/main', 'src/preload', 'src/renderer', 'src/shared']) {
    if (!existsSync(path.join(targetRoot, directory))) throw new Error(`Target is not the expected Electron structure; missing ${directory}`)
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const hasElectron = packageJson.dependencies?.electron || packageJson.devDependencies?.electron
  if (!hasElectron) throw new Error('Target package.json does not declare Electron')

  const conflicts = []
  const sourceAgents = read('AGENTS.md')
  const markerIndex = sourceAgents.indexOf(agentsMarker)
  if (markerIndex < 0) throw new Error(`Source AGENTS.md is missing ${agentsMarker}`)
  const agentsBlock = `${sourceAgents.slice(markerIndex).trim()}\n`
  const targetAgentsPath = path.join(targetRoot, 'AGENTS.md')
  const targetAgents = existsSync(targetAgentsPath) ? readFileSync(targetAgentsPath, 'utf8') : ''
  const targetMarkerIndex = targetAgents.indexOf(agentsMarker)
  let agentsStatus = targetAgents ? 'append' : 'create'
  if (targetMarkerIndex >= 0) {
    const targetBlock = `${targetAgents.slice(targetMarkerIndex).trim()}\n`
    if (targetBlock === agentsBlock) agentsStatus = 'unchanged'
    else {
      agentsStatus = 'conflict'
      conflicts.push('AGENTS.md Harness-lite block')
    }
  }
  const files = harnessFiles.map((relativePath) => {
    const sourceContent = read(relativePath)
    const targetPath = path.join(targetRoot, relativePath)
    if (!existsSync(targetPath)) return { relativePath, status: 'create', sourceContent }
    const targetContent = readFileSync(targetPath, 'utf8')
    if (targetContent === sourceContent) return { relativePath, status: 'unchanged', sourceContent }
    conflicts.push(relativePath)
    return { relativePath, status: 'conflict', sourceContent }
  })

  packageJson.scripts ??= {}
  let packageChanged = false
  for (const [name, command] of Object.entries(harnessScripts)) {
    if (packageJson.scripts[name] === command) continue
    if (packageJson.scripts[name] && packageJson.scripts[name] !== command) conflicts.push(`package.json scripts.${name}`)
    else {
      packageJson.scripts[name] = command
      packageChanged = true
    }
  }
  return { targetRoot, files, conflicts, packageChanged, packageJson, agentsStatus, agentsBlock, targetAgents }
}

function printPlan(plan, dryRun) {
  console.log('Electron Harness-lite incremental adoption')
  console.log(`Target: ${plan.targetRoot}`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`)
  console.log(`${plan.agentsStatus.padEnd(9)} AGENTS.md Harness-lite block`)
  for (const file of plan.files) console.log(`${file.status.padEnd(9)} ${file.relativePath}`)
  console.log(`${plan.packageChanged ? 'update' : 'unchanged'} package.json Harness scripts`)
  if (plan.conflicts.length > 0) {
    console.log('Conflicts:')
    for (const conflict of plan.conflicts) console.log(`- ${conflict}`)
  }
}

function applyPlan(plan) {
  if (plan.conflicts.length > 0) {
    throw new Error(`Refusing to overwrite existing Harness files or scripts:\n${plan.conflicts.map((item) => `- ${item}`).join('\n')}`)
  }
  if (plan.agentsStatus === 'create') {
    writeFileSync(path.join(plan.targetRoot, 'AGENTS.md'), plan.agentsBlock, 'utf8')
  } else if (plan.agentsStatus === 'append') {
    const separator = plan.targetAgents.endsWith('\n') ? '\n' : '\n\n'
    writeFileSync(path.join(plan.targetRoot, 'AGENTS.md'), `${plan.targetAgents}${separator}${plan.agentsBlock}`, 'utf8')
  }
  for (const file of plan.files.filter((item) => item.status === 'create')) {
    const absolute = path.join(plan.targetRoot, file.relativePath)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, file.sourceContent, 'utf8')
  }
  if (plan.packageChanged) {
    writeFileSync(path.join(plan.targetRoot, 'package.json'), `${JSON.stringify(plan.packageJson, null, 2)}\n`, 'utf8')
  }
}

const args = parseArgs(process.argv.slice(2))
const plan = inspectTarget(path.resolve(args.target))
printPlan(plan, args.dryRun)
if (args.dryRun) {
  console.log('Dry run only; no files written.')
} else {
  applyPlan(plan)
  console.log('Electron Harness-lite adoption complete.')
}
