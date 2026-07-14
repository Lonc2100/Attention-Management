import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
/** Resolve a directly spawnable Codex executable, preferring the npm native binary on Windows. */
export function resolveCodexExecutable(): string {
  const configured = process.env.CODEX_EXECUTABLE?.trim()
  if (configured && existsSync(configured)) return configured

  if (process.platform === 'win32') {
    const npmNative = join(
      process.env.APPDATA ?? '',
      'npm',
      'node_modules',
      '@openai',
      'codex',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe'
    )
    if (existsSync(npmNative)) return npmNative

    try {
      const candidates = execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true })
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item && existsSync(item))
      const unpackaged = candidates.find((candidate) => !candidate.toLocaleLowerCase('en-US').includes('\\windowsapps\\'))
      if (unpackaged) return unpackaged
      const first = candidates[0]
      if (first) return first
    } catch {
      // Fall through to the PATH command for a clear spawn/diagnostic error.
    }
  }
  return 'codex'
}
