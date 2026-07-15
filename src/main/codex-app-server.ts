import { z } from 'zod'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { CodexThreadSummary } from '../shared/contracts'
import { resolveCodexExecutable } from './codex-executable'

const wireThreadSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  cwd: z.string().min(1),
  recencyAt: z.number().finite().nullable(),
  source: z.literal('vscode'),
  parentThreadId: z.string().nullable().optional()
}).loose()

const threadListSchema = z.object({ data: z.array(z.unknown()) }).loose()

const responseEnvelopeSchema = z.object({
  id: z.number(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number().optional(),
    message: z.string()
  }).loose().optional()
}).loose()

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

type CodexAppServerClientOptions = {
  executable?: string
  requestTimeoutMs?: number
}

/** Validate the external app-server response and retain only root desktop threads. */
export function parseThreadListResult(input: unknown): CodexThreadSummary[] {
  const list = threadListSchema.safeParse(input)
  if (!list.success) throw new Error('Codex app-server 返回了无法识别的对话列表')

  const threads: CodexThreadSummary[] = []
  for (const item of list.data.data) {
    const parsed = wireThreadSchema.safeParse(item)
    if (!parsed.success || parsed.data.parentThreadId || parsed.data.recencyAt === null) continue
    threads.push({
      id: parsed.data.id,
      name: parsed.data.name?.trim() || null,
      cwd: parsed.data.cwd,
      recencyAt: Math.round(parsed.data.recencyAt * 1000),
      source: 'vscode'
    })
  }
  return threads
}

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private startPromise: Promise<void> | null = null
  private ready = false
  private nextRequestId = 1
  private stdoutBuffer = ''
  private stderrTail = ''
  private lastFailureAt = 0
  private readonly pending = new Map<number, PendingRequest>()
  private readonly executable: string
  private readonly requestTimeoutMs: number

  constructor(options: CodexAppServerClientOptions = {}) {
    this.executable = options.executable ?? resolveCodexExecutable()
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000
  }

  async listRecentInteractiveThreads(): Promise<CodexThreadSummary[]> {
    await this.ensureStarted()
    const result = await this.request('thread/list', {
      limit: 50,
      sortKey: 'recency_at',
      sortDirection: 'desc',
      sourceKinds: ['vscode'],
      archived: false,
      useStateDbOnly: true
    })
    return parseThreadListResult(result)
  }

  close(): void {
    const child = this.child
    this.child = null
    this.ready = false
    this.startPromise = null
    this.rejectPending(new Error('Codex 项目识别服务已停止'))
    child?.kill()
  }

  private async ensureStarted(): Promise<void> {
    if (this.ready && this.child) return
    const retryIn = 15_000 - (Date.now() - this.lastFailureAt)
    if (retryIn > 0) throw new Error(`Codex 项目识别服务正在恢复，请约 ${Math.ceil(retryIn / 1000)} 秒后重试`)
    if (!this.startPromise) {
      this.startPromise = this.start().finally(() => {
        this.startPromise = null
      })
    }
    await this.startPromise
  }

  private async start(): Promise<void> {
    const child = spawn(this.executable, ['app-server'], {
      windowsHide: true,
      stdio: 'pipe'
    })
    this.child = child
    this.stdoutBuffer = ''
    this.stderrTail = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.consumeStdout(chunk))
    child.stderr.on('data', (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-2_000)
    })
    child.on('error', (error) => this.handleExit(child, error))
    child.on('exit', (code) => {
      const detail = this.stderrTail.trim()
      const suffix = detail ? `：${detail}` : ''
      this.handleExit(child, new Error(`Codex app-server 已退出（${code ?? 'unknown'}）${suffix}`))
    })
    try {
      await this.request('initialize', {
        clientInfo: {
          name: 'attention_management',
          title: 'Attention Management',
          version: '0.4.1'
        }
      }, false)
      this.write({ method: 'initialized', params: {} })
      this.ready = true
    } catch (error) {
      this.lastFailureAt = Date.now()
      if (this.child === child) this.child = null
      child.kill()
      throw error
    }
  }

  private request(method: string, params: unknown, ensureReady = true): Promise<unknown> {
    if (ensureReady && !this.ready) return Promise.reject(new Error('Codex app-server 尚未完成初始化'))
    const id = this.nextRequestId
    this.nextRequestId += 1
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server 请求超时：${method}`))
      }, this.requestTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.write({ method, id, params })
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private write(message: unknown): void {
    const child = this.child
    if (!child || child.stdin.destroyed) throw new Error('Codex app-server 连接不可用')
    child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk
    const lines = this.stdoutBuffer.split(/\r?\n/)
    this.stdoutBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        this.handleMessage(JSON.parse(trimmed) as unknown)
      } catch (error) {
        console.error('Codex app-server returned invalid JSON:', error)
      }
    }
  }

  private handleMessage(input: unknown): void {
    const envelope = responseEnvelopeSchema.safeParse(input)
    if (!envelope.success) return
    const pending = this.pending.get(envelope.data.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(envelope.data.id)
    if (envelope.data.error) {
      pending.reject(new Error(`Codex app-server：${envelope.data.error.message}`))
      return
    }
    pending.resolve(envelope.data.result)
  }

  private handleExit(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== child) return
    this.lastFailureAt = Date.now()
    this.ready = false
    this.child = null
    this.rejectPending(error)
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.reject(error)
    }
    this.pending.clear()
  }
}
