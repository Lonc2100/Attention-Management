import { builtinModules } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const NODE_BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]))
const MAIN_LAYERS = new Set(['providers', 'repositories', 'services', 'ipc', 'runtime', 'bootstrap'])

function normalize(value) {
  return value.replaceAll('\\', '/')
}

function listCodeFiles(root, relative = 'src') {
  const absolute = path.join(root, relative)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute).flatMap((name) => {
    const childRelative = normalize(path.join(relative, name))
    const childAbsolute = path.join(root, childRelative)
    if (statSync(childAbsolute).isDirectory()) return listCodeFiles(root, childRelative)
    return CODE_EXTENSIONS.has(path.extname(name)) ? [childRelative] : []
  })
}

export function extractModuleSpecifiers(source) {
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g
  ]
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])))]
}

export function areaOf(relativePath) {
  const file = normalize(relativePath)
  if (file.startsWith('src/shared/')) return { process: 'shared', layer: null }
  if (file.startsWith('src/preload/')) return { process: 'preload', layer: null }
  if (file.startsWith('src/renderer/')) return { process: 'renderer', layer: null }
  if (file.startsWith('src/main/')) {
    const layer = file.split('/')[2]
    return { process: 'main', layer: MAIN_LAYERS.has(layer) ? layer : null }
  }
  return { process: 'other', layer: null }
}

function resolveInternalTarget(root, sourceFile, specifier) {
  if (specifier.startsWith('@shared/')) return normalize(`src/shared/${specifier.slice('@shared/'.length)}`)
  if (specifier.startsWith('@renderer/')) return normalize(`src/renderer/src/${specifier.slice('@renderer/'.length)}`)
  if (!specifier.startsWith('.')) return null
  return normalize(path.relative(root, path.resolve(path.dirname(path.join(root, sourceFile)), specifier)))
}

function isNodeBuiltin(specifier) {
  return NODE_BUILTINS.has(specifier) || specifier.startsWith('node:')
}

function add(errors, file, rule, detail) {
  errors.push({ file, rule, detail, message: `${file}: [${rule}] ${detail}` })
}

function checkMainLayer(errors, file, sourceLayer, targetLayer, specifier) {
  if (!sourceLayer || !targetLayer) return
  const allowed = {
    providers: new Set(['providers']),
    repositories: new Set(['repositories']),
    services: new Set(['providers', 'repositories', 'services']),
    ipc: new Set(['services', 'runtime', 'ipc']),
    runtime: new Set(['providers', 'repositories', 'services', 'runtime']),
    bootstrap: new Set(['providers', 'repositories', 'services', 'ipc', 'runtime', 'bootstrap'])
  }
  if (!allowed[sourceLayer]?.has(targetLayer)) {
    add(errors, file, 'main-layer-direction', `${sourceLayer} cannot import ${targetLayer} via ${specifier}`)
  }
}

export function auditElectronBoundaries(root) {
  const errors = []
  for (const file of listCodeFiles(root)) {
    const source = readFileSync(path.join(root, file), 'utf8')
    const sourceArea = areaOf(file)

    for (const specifier of extractModuleSpecifiers(source)) {
      const targetFile = resolveInternalTarget(root, file, specifier)
      const targetArea = targetFile ? areaOf(targetFile) : { process: 'external', layer: null }

      if (sourceArea.process === 'shared') {
        if (specifier === 'electron' || isNodeBuiltin(specifier)) add(errors, file, 'shared-platform-free', `shared cannot import ${specifier}`)
        if (['main', 'preload', 'renderer'].includes(targetArea.process)) add(errors, file, 'shared-process-free', `shared cannot import ${targetArea.process} via ${specifier}`)
      }

      if (sourceArea.process === 'renderer') {
        if (specifier === 'electron' || isNodeBuiltin(specifier)) add(errors, file, 'renderer-sandbox', `renderer cannot import ${specifier}`)
        if (['main', 'preload'].includes(targetArea.process)) add(errors, file, 'renderer-process-boundary', `renderer cannot import ${targetArea.process} via ${specifier}`)
      }

      if (sourceArea.process === 'preload' && ['main', 'renderer'].includes(targetArea.process)) {
        add(errors, file, 'preload-bridge-only', `preload cannot import ${targetArea.process} via ${specifier}`)
      }

      if (sourceArea.process === 'main' && ['preload', 'renderer'].includes(targetArea.process)) {
        add(errors, file, 'main-process-boundary', `main cannot import ${targetArea.process} via ${specifier}`)
      }

      if (sourceArea.process === 'main' && targetArea.process === 'main') {
        checkMainLayer(errors, file, sourceArea.layer, targetArea.layer, specifier)
      }
    }

    if (sourceArea.process === 'renderer' && /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(/.test(source)) {
      add(errors, file, 'renderer-ipc-only', 'renderer network access must go through the typed preload IPC bridge')
    }
  }
  return errors
}
