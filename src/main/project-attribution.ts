import { win32 } from 'node:path'
import type {
  CodexContextSample,
  CodexThreadSummary,
  ProjectIdentitySource
} from '../shared/contracts'
export type ProjectIdentity = {
  key: string
  label: string
  source: ProjectIdentitySource
}

const GENERIC_WORKSPACE_NAMES = new Set([
  'code',
  'codex',
  'codex work',
  'documents',
  'projects',
  'project',
  'repos',
  'repo',
  'source',
  'src',
  'temp',
  'tmp',
  'work',
  'workspace',
  'workspaces'
])

export function normalizeCodexPath(input: string): string {
  const withoutDevicePrefix = input.trim().replace(/^\\\\\?\\/, '')
  return win32.normalize(withoutDevicePrefix)
}

function cleanThreadName(name: string | null): string {
  const cleaned = (name ?? '')
    .replace(/^[\s!！?？#*_~—–\-:：·.。]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.length > 36 ? `${cleaned.slice(0, 35)}…` : cleaned
}

function isGenericWorkspace(name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase('en-US')
  return normalized.length <= 4 || GENERIC_WORKSPACE_NAMES.has(normalized)
}

/** Derive a stable automatic project identity from a Codex conversation. */
export function deriveProjectIdentity(
  thread: Pick<CodexThreadSummary, 'id' | 'name' | 'cwd'>,
  aliases: Record<string, string>
): ProjectIdentity {
  const cwd = normalizeCodexPath(thread.cwd)
  const folderName = win32.basename(cwd).trim()
  const usesThreadBoundary = !folderName || isGenericWorkspace(folderName)
  const key = usesThreadBoundary
    ? `thread:${thread.id}`
    : `cwd:${cwd.toLocaleLowerCase('en-US')}`
  const alias = aliases[key]?.trim()
  if (alias) return { key, label: alias, source: 'alias' }

  if (!usesThreadBoundary) return { key, label: folderName, source: 'folder' }
  const threadName = cleanThreadName(thread.name)
  if (threadName) return { key, label: threadName, source: 'thread' }
  return { key, label: folderName || 'Codex 未命名项目', source: 'fallback' }
}

export function identityForSample(
  sample: CodexContextSample,
  aliases: Record<string, string>
): ProjectIdentity {
  const alias = aliases[sample.projectKey]?.trim()
  if (alias) return { key: sample.projectKey, label: alias, source: 'alias' }
  return {
    key: sample.projectKey,
    label: sample.projectLabel,
    source: sample.identitySource
  }
}

export function isCodexWindow(app: string, title: string): boolean {
  const appName = app.trim().toLocaleLowerCase('en-US')
  const windowTitle = title.trim().toLocaleLowerCase('en-US')
  if (appName === 'codex' || appName === 'codex.exe') return true
  return (appName === 'chatgpt' || appName === 'chatgpt.exe') && (windowTitle === 'chatgpt' || windowTitle === 'codex')
}
