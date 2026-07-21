import { spawn } from 'node:child_process'
import { win32 as path } from 'node:path'
import type { CodexThreadSummary } from '../../shared/contracts'

/**
 * A small, read-only description of the chat that Codex Desktop currently
 * exposes through Windows UI Automation. It intentionally does not include
 * message text, screenshots, or input contents.
 */
export interface VisibleCodexContext {
  threadName: string
  projectLabel: string | null
  source: 'top-bar' | 'sidebar'
}

type PowerShellRunner = () => Promise<string>

type CodexWindowContextReaderOptions = {
  timeoutMs?: number
  run?: PowerShellRunner
}

const WINDOWS_UI_AUTOMATION_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Write-VisibleContext([string]$threadName, [string]$projectLabel, [string]$source) {
  if ([string]::IsNullOrWhiteSpace($threadName)) { return $false }
  [pscustomobject]@{
    threadName = $threadName.Trim()
    projectLabel = if ([string]::IsNullOrWhiteSpace($projectLabel)) { $null } else { $projectLabel.Trim() }
    source = $source
  } | ConvertTo-Json -Compress
  return $true
}

$processes = Get-Process -Name ChatGPT,codex -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 }

foreach ($process in $processes) {
  try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
    if (-not $root) { continue }

    $documentCondition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
      'RootWebArea'
    )
    $document = $root.FindFirst(
      [System.Windows.Automation.TreeScope]::Descendants,
      $documentCondition
    )
    if (-not $document -or $document.Current.Name -ne 'Codex') { continue }

    # Current Codex Desktop builds may expose a top project strip. Prefer it
    # because it supplies both an exact chat title and the project label.
    $buttonCondition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Button
    )
    $buttons = $document.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      $buttonCondition
    )
    $projectButton = $null
    $projectLabel = $null
    for ($index = 0; $index -lt $buttons.Count; $index += 1) {
      $button = $buttons.Item($index)
      $name = $button.Current.Name
      $rect = $button.Current.BoundingRectangle
      if (
        $name -match '^(项目|Project)\s*[:：]\s*(.+)$' -and
        $rect.Width -gt 0 -and
        $rect.Height -gt 0
      ) {
        $projectButton = $button
        $projectLabel = $Matches[2].Trim()
        break
      }
    }
    if ($projectButton) {
      $projectRect = $projectButton.Current.BoundingRectangle
      $projectCenterY = $projectRect.Y + ($projectRect.Height / 2)
      $textCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Text
      )
      $texts = $document.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        $textCondition
      )
      $titleCandidates = @()
      for ($index = 0; $index -lt $texts.Count; $index += 1) {
        $text = $texts.Item($index)
        $name = $text.Current.Name
        $rect = $text.Current.BoundingRectangle
        $centerY = $rect.Y + ($rect.Height / 2)
        if (
          -not [string]::IsNullOrWhiteSpace($name) -and
          $rect.Width -gt 0 -and
          $rect.Height -gt 0 -and
          $rect.X -ge ($projectRect.X + $projectRect.Width) -and
          $rect.X -le ($projectRect.X + $projectRect.Width + 900) -and
          [Math]::Abs($centerY - $projectCenterY) -le 30
        ) {
          $titleCandidates += [pscustomobject]@{ Name = $name.Trim(); X = $rect.X }
        }
      }
      $title = $titleCandidates | Sort-Object X | Select-Object -First 1
      if ($title -and (Write-VisibleContext $title.Name $projectLabel 'top-bar')) { exit 0 }
    }

    # Some desktop builds expose the selected conversation only as a sidebar
    # item. Read SelectionItemPattern only; never invoke or alter the item.
    # A missing project label is deliberate: TypeScript later refuses duplicate
    # thread titles instead of guessing from recency.
    $sidebarControlTypes = @(
      [System.Windows.Automation.ControlType]::ListItem,
      [System.Windows.Automation.ControlType]::TreeItem,
      [System.Windows.Automation.ControlType]::TabItem
    )
    foreach ($controlType in $sidebarControlTypes) {
      $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        $controlType
      )
      $items = $document.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
      for ($index = 0; $index -lt $items.Count; $index += 1) {
        $item = $items.Item($index)
        $rect = $item.Current.BoundingRectangle
        if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }
        try {
          $pattern = $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
          if (-not $pattern -or -not $pattern.Current.IsSelected) { continue }
          if (Write-VisibleContext $item.Current.Name $null 'sidebar') { exit 0 }
        } catch {
          continue
        }
      }
    }
  } catch {
    continue
  }
}
`

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('zh-CN')
}

function cwdLabel(cwd: string): string {
  return normalize(path.basename(path.normalize(cwd)))
}

export function parseCodexWindowContextOutput(output: string): VisibleCodexContext | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    const line = trimmed.split(/\r?\n/u).filter(Boolean).at(-1) ?? ''
    parsed = JSON.parse(line)
  } catch {
    throw new Error('Windows 返回了无法识别的 Codex 当前聊天信息')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Windows 返回了无法识别的 Codex 当前聊天信息')
  const value = parsed as Record<string, unknown>
  const threadName = typeof value.threadName === 'string' ? value.threadName.trim() : ''
  const projectLabel = typeof value.projectLabel === 'string' ? value.projectLabel.trim() : ''
  const source = value.source === 'sidebar' ? 'sidebar' : 'top-bar'
  if (!threadName) throw new Error('Windows 返回了无法识别的 Codex 当前聊天信息')
  return { threadName, projectLabel: projectLabel || null, source }
}

export function matchVisibleCodexThread(
  visible: VisibleCodexContext,
  threads: CodexThreadSummary[]
): CodexThreadSummary | null {
  const expectedName = normalize(visible.threadName)
  const titleMatches = threads.filter((thread) => thread.name && normalize(thread.name) === expectedName)
  if (titleMatches.length === 0) return null
  if (!visible.projectLabel) return titleMatches.length === 1 ? titleMatches[0] : null

  const expectedProject = normalize(visible.projectLabel)
  const projectMatches = titleMatches.filter((thread) => cwdLabel(thread.cwd) === expectedProject)
  return projectMatches.length === 1 ? projectMatches[0] : null
}

function runPowerShell(timeoutMs: number): Promise<string> {
  const encoded = Buffer.from(WINDOWS_UI_AUTOMATION_SCRIPT, 'utf16le').toString('base64')
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encoded
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(stdout)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(new Error('读取当前 Codex 聊天超时'))
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-16_384)
    })
    child.stderr.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-2_048)
    })
    child.on('error', (error) => finish(error))
    child.on('exit', (code) => {
      if (code === 0) finish()
      else finish(new Error(`读取当前 Codex 聊天失败（${code ?? 'unknown'}）${stderr.trim() ? `：${stderr.trim()}` : ''}`))
    })
  })
}

export class CodexWindowContextReader {
  private readonly run: PowerShellRunner

  constructor(options: CodexWindowContextReaderOptions = {}) {
    this.run = options.run ?? (() => runPowerShell(options.timeoutMs ?? 2_000))
  }

  async readCurrentContext(): Promise<VisibleCodexContext | null> {
    return parseCodexWindowContextOutput(await this.run())
  }
}
