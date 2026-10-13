import { Context, h, type Session } from 'koishi'
import OneBot from 'koishi-plugin-adapter-onebot'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import QRCode from 'qrcode'
import { command, componentsPath, componentsReady, installComponents } from './qq-components'

export type QQPolicy = { enabled: boolean; users: string[]; groups: string[] }
export type QQMessage = { id: string; conversation: string; sender: string; name: string; content: string; time: number; outgoing: boolean }
type Inbox = { messages: QQMessage[]; read: Record<string, number>; requests: Record<string, { content: string; conversation: string; status: string }> }
const atomic = (file: string, value: unknown) => { writeFileSync(file + '.tmp', JSON.stringify(value), { mode: 0o600 }); renameSync(file + '.tmp', file) }
export function qqPolicy(value: any): QQPolicy {
  const ids = (list: unknown) => {
    if (!Array.isArray(list) || list.length > 100 || list.some(id => typeof id !== 'string' || !/^[1-9]\d{4,14}$/.test(id))) throw new Error('QQ 白名单须为数字账号，每类最多 100 个')
    return [...new Set(list)] as string[]
  }
  if (typeof value?.enabled !== 'boolean') throw new Error('无效 QQ 设置')
  return { enabled: value.enabled, users: ids(value.users), groups: ids(value.groups) }
}
export function plainMessage(content: string) {
  const text = h.parse(content).map(part => part.type === 'text' ? part.attrs.content : part.type === 'at' ? `@${part.attrs.name || part.attrs.id || '成员'} ` : `[${({ image: '图片', audio: '语音', video: '视频', file: '文件', face: '表情', quote: '引用' } as Record<string, string>)[part.type] || '消息'}]`).join('')
  // Bound a 200-message history below the native bridge's 4 MiB response cap.
  return text.length > 4000 ? text.slice(0, 4000) + '…（信箱显示已截断）' : text
}
async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = (server.address() as { port: number }).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}

/** Runs in the same PRoot as HDS. No shell interpolation, remote command API, or UI tokens. */
export class QQRuntime {
  private child?: ChildProcess
  private display?: ChildProcess
  private fork?: ReturnType<Context['plugin']>
  private webToken = ''; private credential = ''; private credentialAt = 0; private wsToken = ''
  private webPort = 0; private wsPort = 0; private startedAt = 0
  private phase = 'stopped'; private progress = ''; private error = ''; private logs: string[] = []
  private account = ''; private nickname = ''; private qr = ''; private qrImage = ''
  private loginOnline = false; private polling = false; private closing = false
  private installation?: Promise<void>; private cancellation?: AbortController
  private timer: ReturnType<typeof setInterval>
  private policy: QQPolicy = { enabled: false, users: [], groups: [] }
  private inbox: Inbox = { messages: [], read: {}, requests: {} }
  private sending = Promise.resolve()
  private control = Promise.resolve()
  private generation = 0
  constructor(private app: Context, private directory: string, private profile: string, private config: any, private bindStory?: (account: string) => Promise<void>) {
    mkdirSync(directory, { recursive: true }); mkdirSync(join(directory, 'home'), { recursive: true }); mkdirSync(join(directory, 'config'), { recursive: true })
    if (existsSync(join(profile, 'qq-policy.json'))) this.policy = qqPolicy(JSON.parse(readFileSync(join(profile, 'qq-policy.json'), 'utf8')))
    this.applyPolicy()
    const seen = new Set<string>()
    app.on('bot-added', bot => {
      // The adapter constructs its platform fields immediately after Bot's constructor.
      queueMicrotask(() => {
        if (bot.platform !== 'onebot') return
        const dispatch = bot.dispatch.bind(bot)
        bot.dispatch = session => {
          if (session.type === 'message' || session.type === 'message-created') {
            if (session.userId === session.selfId) return
            const id = `${session.selfId}:${session.messageId}`
            if (session.messageId) {
              if (seen.has(id) || this.inbox.messages.some(message => message.id === id)) return
              seen.add(id); if (seen.size > 4096) seen.delete(seen.values().next().value!)
            }
          }
          return dispatch(session)
        }
      })
    })
    app.middleware((session, next) => {
      if (session.platform !== 'onebot') return next()
      if (session.selfId !== this.account || session.userId === this.account || !this.policy.enabled) return
      const allowed = session.isDirect ? this.policy.users.includes(session.userId) : this.policy.groups.includes(session.guildId || session.channelId)
      if (allowed) return next()
    }, true)
    // Observe incoming messages before HDS's own middleware; group/private gates remain authoritative.
    app.on('message', session => { if (session.platform === 'onebot' && session.selfId === this.account) this.record(session, false) })
    app.on('send', session => { if (session.platform === 'onebot' && session.selfId === this.account) this.record(session, true) })
    app.before('send', session => {
      if (session.platform !== 'onebot') return
      const id = session.channelId?.replace(/^private:/, '') || ''
      const allowed = session.channelId?.startsWith('private:') ? this.policy.users.includes(id) : this.policy.groups.includes(id)
      if (!this.policy.enabled || !allowed || session.selfId !== this.account || !this.loginOnline) throw new Error('QQ 自动投递已暂停或目标未授权')
    })
    this.timer = setInterval(() => void this.poll(), 2000)
  }
  private bot() { return this.app.bots.find(bot => bot.platform === 'onebot' && bot.selfId === this.account) as InstanceType<typeof OneBot> | undefined }
  private applyPolicy() {
    Object.assign(this.config.onebot, { enabled: true, ignoreSelfMessages: true,
      botAccounts: this.policy.enabled && this.account ? [{ qq: this.account, enabled: true }] : [],
      userAccounts: this.policy.users.map(qq => ({ qq, enabled: true })),
      groupChats: this.policy.groups.map(groupId => ({ groupId, enabled: this.policy.enabled, assignee: this.account, responseMode: 'mention-only', contextLimit: 20, debounceSeconds: 1, cooldownSeconds: 60 })),
    })
  }
  private inboxFile() { if (!/^[1-9]\d{4,14}$/.test(this.account)) throw new Error('QQ 账号尚未就绪'); return join(this.directory, `inbox-${this.account}.json`) }
  private saveInbox() { atomic(this.inboxFile(), this.inbox) }
  private record(session: Session, outgoing: boolean) {
    const conversation = session.isDirect || session.channelId?.startsWith('private:') ? `private:${session.channelId?.replace(/^private:/, '') || session.userId}` : `group:${session.guildId || session.channelId}`
    const id = `${this.account}:${session.messageId}`
    if (!session.messageId || this.inbox.messages.some(message => message.id === id)) return
    this.inbox.messages.push({ id, conversation, sender: outgoing ? this.account : session.userId, name: outgoing ? this.nickname : session.username || session.userId, content: plainMessage(session.content || ''), time: session.timestamp || Date.now(), outgoing })
    this.inbox.messages = this.inbox.messages.slice(-2000); this.saveInbox()
  }
  private diagnostic(text: string) {
    const safe = text.replace(/https?:\/\/\S+/g, '[URL]').replaceAll(this.directory, '[qq-data]').replaceAll(this.webToken || '\0', '[token]').replaceAll(this.wsToken || '\0', '[token]').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)
    this.logs.push(safe); this.logs = this.logs.slice(-30)
  }
  async api(method: string, data: unknown = {}, authenticate = true): Promise<any> {
    if (authenticate && (!this.credential || Date.now() - this.credentialAt > 3000000)) {
      const login = await this.api('auth/login', { hash: createHash('sha256').update(this.webToken + '.napcat').digest('hex') }, false)
      if (typeof login.Credential !== 'string') throw new Error('QQ 本地管理接口认证失败')
      this.credential = login.Credential; this.credentialAt = Date.now()
    }
    const response = await fetch(`http://127.0.0.1:${this.webPort}/api/${method}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...(authenticate ? { Authorization: `Bearer ${this.credential}` } : {}) }, body: JSON.stringify(data) })
    if (!response.ok) throw new Error(`QQ 本地接口 HTTP ${response.status}`)
    const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let bytes = 0
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; if (bytes > 1024 * 1024) throw new Error('QQ 响应过大'); chunks.push(chunk.value) } } finally { await reader.cancel() }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (result.code !== 0) { this.credential = ''; throw new Error(String(result.message || 'QQ 请求失败').slice(0, 200)) }
    return result.data
  }
  private async poll() {
    if (!this.child || this.polling || this.closing) return
    this.polling = true
    const generation = this.generation
    try {
      const status = await this.api('QQLogin/CheckLoginStatus')
      if (this.closing || !this.child || generation !== this.generation) return
      this.loginOnline = status.isLogin === true && status.coreReady === true
      if (this.loginOnline) {
        const info = await this.api('QQLogin/GetQQLoginInfo')
        if (this.closing || generation !== this.generation) return
        const account = String(info.uin || '')
        if (!/^[1-9]\d{4,14}$/.test(account)) throw new Error('QQ 返回无效账号')
        if (this.account !== account || !this.fork) {
          if (this.fork) await this.fork.dispose()
          this.account = account; this.nickname = String(info.nick || account).slice(0, 100)
          this.inbox = existsSync(this.inboxFile()) ? JSON.parse(readFileSync(this.inboxFile(), 'utf8')) : { messages: [], read: {}, requests: {} }
          this.applyPolicy()
          await this.bindStory?.(account)
          if (this.closing || generation !== this.generation) return
          this.fork = this.app.plugin(OneBot, { selfId: account, protocol: 'ws', endpoint: `ws://127.0.0.1:${this.wsPort}`, token: this.wsToken, retryTimes: Infinity, retryInterval: 3000, retryLazy: 3000, responseTimeout: 15000 })
          for (const group of this.policy.groups) await this.app.database.upsert('channel', [{ platform: 'onebot', id: group, assignee: account }])
        }
        this.qr = ''; this.qrImage = ''; this.phase = this.bot()?.status === 1 ? 'online' : 'connecting'; this.error = ''
        this.progress = this.phase === 'online' ? 'QQ 与 HDS 消息通道已连接' : 'QQ 已登录，正在连接消息通道'
      } else {
        this.phase = status.isOffline ? 'offline' : ['qrcode_scanned', 'initializing'].includes(status.loginPhase) ? 'confirming' : 'qr'
        this.progress = this.phase === 'confirming' ? '已扫码，等待手机确认与 QQ 初始化' : this.phase === 'offline' ? 'QQ 已离线，请重新登录' : '请用官方 QQ 扫码确认登录'
        this.error = String(status.loginError || '').slice(0, 200)
        const qr = String(status.qrcodeurl || '')
        if (qr !== this.qr) { this.qr = qr; this.qrImage = qr && qr.length < 4096 ? await QRCode.toDataURL(qr, { width: 320, margin: 2 }) : '' }
      }
    } catch (error) {
      if (this.closing || generation !== this.generation) return
      this.loginOnline = false
      if (this.phase === 'starting' && Date.now() - this.startedAt < 120000) return
      this.phase = 'failed'; this.error = `QQ 状态未就绪：${error instanceof Error ? error.message : '连接中断'}`
      this.qrImage = ''
    } finally { this.polling = false }
  }
  async start() {
    if (this.child || this.installation || this.phase === 'starting') throw new Error('QQ 正在运行或安装，请先停止')
    if (!componentsReady(this.directory)) throw new Error('请先下载 QQ 组件')
    this.generation++; this.closing = false; this.phase = 'starting'; this.progress = '启动本机 QQ，首次加载可能需要两分钟'; this.error = ''; this.logs = []; this.startedAt = Date.now()
    this.webToken = randomBytes(32).toString('hex'); this.wsToken = randomBytes(32).toString('hex'); this.credential = ''
    this.webPort = await freePort(); this.wsPort = await freePort()
    const configDir = join(this.directory, 'config')
    atomic(join(configDir, 'webui.json'), { host: '127.0.0.1', port: this.webPort, token: this.webToken, autoLoginAccount: '', loginRate: 100, disableWebUI: false })
    const network = { network: { websocketServers: [{ name: 'hds-local', enable: true, host: '127.0.0.1', port: this.wsPort, token: this.wsToken, messagePostFormat: 'array', reportSelfMessage: false, enableForcePushEvent: true }] } }
    for (const filename of ['onebot11.json', ...readdirSync(configDir).filter(name => /^onebot11_\d+\.json$/.test(name))]) atomic(join(configDir, filename), network)
    const root = componentsPath(this.directory), qq = join(root, 'opt/QQ/resources/app')
    // Use the upstream installer path: official QQ + NapCat application entry,
    // with a private virtual display. No window is shown outside the container.
    const displayNumber = 100 + randomBytes(2).readUInt16LE() % 10000
    const authority = join(this.directory, 'display.auth')
    writeFileSync(authority, '', { mode: 0o600 })
    await command('/usr/bin/xauth', ['-f', authority, 'add', `:${displayNumber}`, 'MIT-MAGIC-COOKIE-1', randomBytes(16).toString('hex')])
    const display = spawn('/usr/bin/Xvfb', [`:${displayNumber}`, '-screen', '0', '640x480x24', '-nolisten', 'tcp', '-auth', authority], { stdio: ['ignore', 'ignore', 'pipe'] })
    this.display = display
    display.stderr?.on('data', data => this.diagnostic(String(data)))
    let displayFailure = ''
    display.once('error', error => { displayFailure = error.message })
    display.once('exit', code => { if (!this.closing) displayFailure = `Xvfb 退出：${code}` })
    const deadline = Date.now() + 10000
    while (!existsSync(`/tmp/.X11-unix/X${displayNumber}`)) {
      if (displayFailure || Date.now() > deadline) { display.kill(); this.display = undefined; this.phase = 'failed'; throw new Error(displayFailure || 'QQ 虚拟显示初始化超时') }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    const environment = { ...process.env,
      DISPLAY: `:${displayNumber}`, XAUTHORITY: authority, NAPCAT_MAIN_PATH: join(root, 'napcat/napcat.mjs'),
      HOME: join(this.directory, 'home'), XDG_CONFIG_HOME: join(this.directory, 'home/.config'), NAPCAT_WORKDIR: this.directory,
      NAPCAT_WRAPPER_PATH: join(qq, 'wrapper.node'), NAPCAT_QQ_PACKAGE_INFO_PATH: join(qq, 'package.json'),
      NAPCAT_DISABLE_PIPE: '1', NAPCAT_DISABLE_TIME_SYNC: '1', NAPCAT_DISABLE_BYPASS: '1',
      // Linux QQ's libbugly references GnuTLS symbols supplied by its desktop
      // process. Node needs the same library in the global loader namespace.
      LD_PRELOAD: '/usr/lib/aarch64-linux-gnu/libgnutls.so.30',
      LD_LIBRARY_PATH: [qq, join(qq, 'sharp-lib'), join(qq, 'lib'), join(root, 'opt/QQ'), '/usr/lib/aarch64-linux-gnu'].join(':'),
    }
    delete environment.ELECTRON_RUN_AS_NODE
    const child = spawn(join(root, 'opt/QQ/qq'), ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], { cwd: join(root, 'opt/QQ'), env: environment, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', data => {
      for (const line of data.toString().split(/\r?\n/)) if (/error|fatal|sandbox|failed|not found|undefined symbol|cannot|失败/i.test(line) && !/qrcode|二维码|token|message content/i.test(line)) this.diagnostic(line)
    })
    child.once('error', error => { this.phase = 'failed'; this.error = `QQ 无法启动：${error.message}`; this.diagnostic(this.error) })
    child.once('exit', (code, signal) => { if (this.child !== child) return; this.child = undefined; this.display?.kill(); this.display = undefined; this.loginOnline = false; this.qrImage = ''; if (!this.closing) { this.phase = 'failed'; this.error = `QQ 进程退出（${signal || code}），请查看 QQ 日志`; void this.fork?.dispose(); this.fork = undefined } })
    await this.poll()
  }
  async stop() {
    this.generation++; this.closing = true; this.loginOnline = false; this.qrImage = ''; this.qr = ''
    this.cancellation?.abort(); await this.installation
    if (this.fork) { await this.fork.dispose(); this.fork = undefined }
    const child = this.child
    if (child) {
      await new Promise<void>(resolve => {
        if (child.exitCode !== null) { resolve(); return }
        const terminate = (signal: NodeJS.Signals) => { try { if (child.pid) process.kill(-child.pid, signal) } catch { child.kill(signal) } }
        const kill = setTimeout(() => terminate('SIGKILL'), 3000)
        child.once('exit', () => { clearTimeout(kill); terminate('SIGKILL'); resolve() }); terminate('SIGTERM')
      })
    }
    this.display?.kill(); this.display = undefined
    this.child = undefined; this.phase = 'stopped'; this.progress = 'QQ 已停止，登录记录保留'; this.error = ''
  }
  async close() { clearInterval(this.timer); await this.control; await this.stop(); await this.sending }
  status() { return { phase: this.phase, installed: componentsReady(this.directory), running: !!this.child, progress: this.progress, error: this.error, account: this.account, nickname: this.nickname, qr: this.qrImage, policy: this.policy, logs: this.logs, online: this.loginOnline && this.bot()?.status === 1 } }
  async dispatch(method: string, payload: any) {
    if (['qq.install', 'qq.start', 'qq.stop', 'qq.refreshQr', 'qq.quickLogin', 'qq.policy'].includes(method)) {
      const result = this.control.then(() => this.handle(method, payload))
      this.control = result.then(() => {}, () => {})
      return result
    }
    return this.handle(method, payload)
  }
  private async handle(method: string, payload: any) {
    if (method === 'qq.status') return this.status()
    if (method === 'qq.install') {
      if (this.child || this.installation) throw new Error('请先停止 QQ 或等待当前安装')
      this.cancellation = new AbortController(); this.phase = 'installing'; this.error = ''
      const timeout = setTimeout(() => this.cancellation?.abort(), 15 * 60 * 1000)
      this.installation = installComponents(this.directory, this.cancellation.signal, text => { this.progress = text })
        .then(() => { this.phase = 'stopped' }).catch(error => { this.phase = 'failed'; this.error = this.cancellation?.signal.aborted ? '安装已取消或超时，可重新下载' : error.message }).finally(() => { clearTimeout(timeout); this.installation = undefined })
      return this.status()
    }
    if (method === 'qq.start') { try { await this.start() } catch (error) { this.display?.kill(); this.display = undefined; this.phase = 'failed'; this.error = error instanceof Error ? error.message : 'QQ 启动失败'; throw error }; return this.status() }
    if (method === 'qq.stop') { await this.stop(); return this.status() }
    if (method === 'qq.refreshQr') { if (!this.child) throw new Error('请先启动 QQ'); await this.api('QQLogin/RefreshQRcode'); this.qr = ''; await this.poll(); return this.status() }
    if (method === 'qq.accounts') return this.child ? await this.api('QQLogin/GetQuickLoginListNew') : []
    if (method === 'qq.quickLogin') {
      if (!/^[1-9]\d{4,14}$/.test(payload.uin || '')) throw new Error('无效 QQ 账号')
      await this.api('QQLogin/SetQuickLogin', { uin: payload.uin }); return { accepted: true }
    }
    if (method === 'qq.policy') { this.policy = qqPolicy(payload); atomic(join(this.profile, 'qq-policy.json'), this.policy); this.applyPolicy(); for (const group of this.policy.groups) if (this.account) await this.app.database.upsert('channel', [{ platform: 'onebot', id: group, assignee: this.account }]); return this.policy }
    if (method === 'qq.conversations') {
      const map = new Map<string, any>()
      for (const message of this.inbox.messages) { const row = map.get(message.conversation) || { id: message.conversation, unread: 0 }; Object.assign(row, { last: message.content, time: message.time, name: message.conversation.startsWith('group:') ? `群 ${message.conversation.slice(6)}` : message.outgoing ? row.name || message.conversation.slice(8) : message.name }); if (!message.outgoing && message.time > (this.inbox.read[message.conversation] || 0)) row.unread++; map.set(row.id, row) }
      return [...map.values()].sort((a, b) => b.time - a.time)
    }
    if (method === 'qq.history') {
      if (!/^(private|group):[1-9]\d{4,14}$/.test(payload.conversation || '')) throw new Error('无效会话')
      if (this.account) { this.inbox.read[payload.conversation] = Date.now(); this.saveInbox() }
      return this.inbox.messages.filter(message => message.conversation === payload.conversation).slice(-200)
    }
    if (method === 'qq.send') {
      const { conversation, requestId } = payload, content = String(payload.content || '').trim()
      if (!/^(private|group):[1-9]\d{4,14}$/.test(conversation || '') || !/^[a-zA-Z0-9-]{8,64}$/.test(requestId || '') || !content || content.length > 4000) throw new Error('无效 QQ 消息')
      const send = async () => {
        const bot = this.bot(); if (!bot || !this.status().online) throw new Error('QQ 消息通道尚未在线')
        const old = this.inbox.requests[requestId]
        if (old) { if (old.content !== content || old.conversation !== conversation) throw new Error('消息编号冲突'); if (old.status !== 'sent') throw new Error('上次发送结果不明，请先在官方 QQ 核对，避免重复发送'); return { sent: true, duplicate: true } }
        this.inbox.requests[requestId] = { conversation, content, status: 'pending' }; this.saveInbox()
        const peer = conversation.split(':')[1]
        // Text segment prevents CQ-code injection; manual sending is a distinct user action.
        const message = [{ type: 'text', data: { text: content } }]
        const receipt = conversation.startsWith('private:') ? await bot.internal.sendPrivateMsg(peer, message) : await bot.internal.sendGroupMsg(peer, message)
        this.inbox.requests[requestId].status = 'sent'
        this.inbox.messages.push({ id: `${this.account}:${receipt}`, conversation, sender: this.account, name: this.nickname, content, time: Date.now(), outgoing: true }); this.inbox.messages = this.inbox.messages.slice(-2000)
        const keys = Object.keys(this.inbox.requests); for (const key of keys.slice(0, Math.max(0, keys.length - 2000))) delete this.inbox.requests[key]
        this.saveInbox(); return { sent: true }
      }
      const result = this.sending.then(send); this.sending = result.then(() => {}, () => {}); return result
    }
    throw new Error('不允许的 QQ 方法')
  }
}
