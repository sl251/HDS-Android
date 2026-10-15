import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { AsyncLocalStorage } from 'node:async_hooks'

export class BackgroundBudget {
  private calls: number[]
  private manual = new AsyncLocalStorage<{ active: boolean }>()
  constructor(private file: string, readonly limit: number, private now = Date.now) {
    this.calls = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
    if (!Array.isArray(this.calls) || !this.calls.every(time => Number.isFinite(time) && time >= 0)) throw new Error('后台预算记录损坏，请保留诊断文件后修复')
  }
  status() {
    const now = this.now()
    // Retain future timestamps after a clock rollback; never reset on restart.
    this.calls = this.calls.filter(time => time > now - 86400000).sort((a, b) => a - b)
    return { limit: this.limit, used: this.calls.length, exhausted: this.limit > 0 && this.calls.length >= this.limit,
      resumesAt: this.calls.length ? Math.max(...this.calls.slice(0, Math.max(1, this.calls.length - this.limit + 1))) + 86400000 : null }
  }
  beforeRequest = (foreground = false) => {
    if (foreground || this.manual.getStore()?.active) return
    if (this.status().exhausted) throw Object.assign(new Error('已达 24 小时后台模型预算；直接聊天仍可用'), { code: 'HDS_MOBILE_BUDGET' })
    this.calls.push(this.now())
    // Reserve before transport, including failed/unknown attempts.
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.calls))
    renameSync(`${this.file}.tmp`, this.file)
  }
  async runManual<T>(task: () => T | Promise<T>): Promise<T> {
    const scope = { active: true }
    try { return await this.manual.run(scope, task) } finally { scope.active = false }
  }
}
