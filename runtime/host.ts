import { Context, Bot, h } from 'koishi'
import { HTTP } from '@cordisjs/plugin-http'
import { SQLiteDriver } from '@minatojs/driver-sqlite'
import { createServer } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import * as HDS from '../upstream/hds-interlude/src/index'
import { cardPrompt, type Card } from '../packages/card-format'
import { mobileModelConfig } from './model-config'
import type { ModelOptions, ModelProvider } from '../packages/contracts'
import { messageImages } from '../packages/contracts'
import { personaDefaults, personaEditPatch } from './persona'
import { QQRuntime } from './qq'
import { imageStore } from './media'

export type HostConfig = { card: Card; endpoint: string; model: string; apiKey?: string; providers?: ModelProvider[]; modelOptions?: Partial<ModelOptions>; userName: string; userProfile: string; autoAdvance: boolean; token: string; port: number; dataDir: string; qqDir?: string }
export async function startHost(input: HostConfig) {
  if (!input.card?.name || !input.model || !input.endpoint || !input.token || input.token.length < 32) throw new Error('Missing valid host configuration')
  const endpoint = new URL(input.endpoint)
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid model endpoint')
  mkdirSync(input.dataDir, { recursive: true })
  const restoreMarker = join(input.dataDir, 'restore-held.json')
  let restoreHeld = existsSync(restoreMarker)
  const app = new Context({ prefix: ['interlude.'] })
  app.baseDir = input.dataDir
  app.plugin(HTTP)
  app.plugin(SQLiteDriver, { path: join(input.dataDir, 'hds.sqlite') })
  app.model.extend('mobile_message', { id: 'string(64)', direction: 'string(16)', content: 'text', occurredAt: 'timestamp', status: 'string(32)', images: { type: 'json', initial: [] } }, { primary: 'id' })
  app.model.extend('mobile_request', { id: 'string(64)', content: 'text', status: 'string(32)', occurredAt: 'timestamp' }, { primary: 'id' })
  class LocalBot extends Bot {
    private disposed = false
    constructor(ctx: Context) { super(ctx, {}, 'mobile-local'); this.user = { id: 'local-role', name: input.card.name } }
    async start() { this.online() }
    dispose() { if (this.disposed) return; super.dispose(); this.disposed = true }
    async sendMessage(channelId: string, content: unknown) {
      if (restoreHeld) throw new Error('恢复的故事需先明确恢复运行')
      if (!['private:local-user', 'local-user'].includes(channelId)) throw new Error('Local transport target is not authorized')
      const id = randomUUID()
      const text = h.parse(String(content)).map(element => element.type === 'text' ? element.attrs.content : element.toString()).join('')
      await app.database.create('mobile_message' as never, { id, direction: 'character', content: text, images: [], occurredAt: new Date(), status: 'delivered' } as never)
      return [id]
    }
    async createDirectChannel(userId: string) { return { id: `private:${userId}`, type: 1 } }
  }
  let bot!: LocalBot
  app.plugin(ctx => { bot = new LocalBot(ctx) })
  const config = HDS.Config({
    storyDefaults: personaDefaults(input.card, input.userProfile),
    model: mobileModelConfig(input),
    runtime: { autoCreate: true, autoAdvanceEnabled: input.autoAdvance, allowProactiveMessages: input.autoAdvance, userMessageDebounceSeconds: 1, conversationFollowUpMinutes: input.autoAdvance ? [10, 20] : [], typingMaxDelaySeconds: 12 },
    logging: { level: 'warn', colors: false, kaomoji: false, logMessageContent: false, logScriptPreview: false },
    timelineDirector: { enabled: input.autoAdvance },
    qzone: { enabled: false }, browser: { enabled: false },
    onebot: { enabled: true, botAccounts: [], userAccounts: [], groupChats: [], ignoreSelfMessages: true },
  })
  config.model.vision = { enabled: input.modelOptions?.visionEnabled === true, mode: 'native', detail: 'auto', maxImageDimension: 1024 }
  const media = imageStore(input.dataDir)
  let promptTrace: string[] = []
  config.model.mobileCardPrompt = request => {
    if (input.card.format === 'hds') { promptTrace = ['HDS 原生 storyDefaults 映射']; return { before: '', after: '' } }
    const history = request.recentEntries.filter(entry => entry.kind === 'user-message' || entry.kind === 'character-message').map(entry => entry.content)
    if (request.userMessage) history.push(request.userMessage)
    const compiled = cardPrompt(input.card, input.userName || '我', history)
    promptTrace = compiled.trace
    return compiled
  }
  app.plugin(HDS, config)
  await app.start()
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('HDS initialization timed out')), 30000)
    const check = () => { if (app.interlude && app.database) { clearTimeout(deadline); resolve() } else setTimeout(check, 100) }
    check()
  })
  const session = (id = randomUUID(), content = '', images: string[] = []) => {
    const value = bot.session({ type: 'message', timestamp: Date.now(), user: { id: 'local-user', name: input.userName || '我' }, channel: { id: 'private:local-user', type: 1 }, message: { id, elements: [h.text(content), ...images.map(image => h.image(image))] } })
    // Management RPC calls the HDS service directly, so the local adapter supplies
    // the same receipt-producing send operation normally attached by Koishi middleware.
    return Object.assign(value, { username: input.userName || '我', send: (fragment: unknown) => bot.sendMessage('private:local-user', fragment) })
  }
  // A dedicated profile owns this database; no QQ identity is fabricated.
  const current = session()
  let story = await app.interlude.findStory(current) ?? await app.interlude.createStory(current)
  if (restoreHeld) { await app.interlude.setDesktopRuntimePhase('paused'); story = await app.interlude.setStatus(story, 'paused') }
  const cardRevisionFile = join(input.dataDir, 'card-revision.json')
  const appliedRevision = existsSync(cardRevisionFile) ? JSON.parse(readFileSync(cardRevisionFile, 'utf8')).revision : 0
  if ((input.card.revision ?? 0) > appliedRevision) {
    const patch = personaEditPatch(input.card)
    if (input.card.hds && !input.userProfile.trim() && 'userProfile' in input.card.hds.storyDefaults) {
      patch.user = { ...story.setting.user, profile: String(input.card.hds.storyDefaults.userProfile) }
    }
    story = await app.interlude.updateSetting(story, patch)
    writeFileSync(`${cardRevisionFile}.tmp`, JSON.stringify({ revision: input.card.revision }))
    renameSync(`${cardRevisionFile}.tmp`, cardRevisionFile)
  }
  if (input.card.firstMessage) {
    const key = 'card-opening-v1'
    const old = await app.database.get('mobile_message' as never, { id: key } as never)
    if (!old.length) await app.database.create('mobile_message' as never, { id: key, direction: 'character', content: input.card.firstMessage.replaceAll('{{char}}', input.card.name).replaceAll('{{user}}', input.userName || '我'), images: [], occurredAt: new Date(), status: 'card-opening' } as never)
    await app.interlude.mobileRecordLocalOpening(story, current, input.card.firstMessage.replaceAll('{{char}}', input.card.name).replaceAll('{{user}}', input.userName || '我'))
  }
  let queue = Promise.resolve()
  let closing = false
  const jobFile = join(input.dataDir, 'maintenance-jobs.json')
  type Job = { id: string; kind: string; status: 'running' | 'done' | 'failed'; result?: unknown; error?: string }
  const jobs: Record<string, Job> = existsSync(jobFile) ? JSON.parse(readFileSync(jobFile, 'utf8')) : {}
  for (const job of Object.values(jobs)) if (job.status === 'running') { job.status = 'failed'; job.error = '核心重启中断了操作，请检查结果后重试' }
  const saveJobs = () => { writeFileSync(`${jobFile}.tmp`, JSON.stringify(jobs)); renameSync(`${jobFile}.tmp`, jobFile) }
  saveJobs()
  const work = new Set<Promise<void>>()
  const qq = input.qqDir ? new QQRuntime(app, input.qqDir, input.dataDir, app.interlude.config, async account => {
    const result = await app.interlude.addStoryEndpoint(story, 'onebot', account, 'qq')
    if (!result.ok) throw new Error(result.error || '无法绑定 QQ 与当前角色故事')
  }) : undefined
  const dispatch = async (method: string, payload: Record<string, unknown>) => {
    if (closing) throw new Error('核心正在关闭，请稍后再试')
    if (method.startsWith('qq.')) { if (!qq) throw new Error('QQ 本机目录未配置'); return qq.dispatch(method, payload) }
    if (method === 'images.upload') return { id: media.save(payload.dataUri).id }
    if (method === 'images.get') return { dataUri: media.get(String(payload.id)) }
    if (method === 'memory.facts') return app.interlude.adminFacts(story.id, 100)
    if (method === 'memory.factSources') {
      const id = Number(payload.id)
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效事实编号')
      const fact = (await app.database.get('interlude_fact', { id, storyId: story.id }))[0]
      if (!fact) throw new Error('未找到当前故事的事实')
      const ids = (fact.sourceEntryIds ?? []).slice(0, 40)
      return ids.length ? (await app.database.get('interlude_script_entry', { storyId: story.id, id: { $in: ids } })).filter(entry => entry.kind !== 'redacted').map(entry => ({ content: entry.content, occurredAt: entry.occurredAt })) : []
    }
    if (method === 'maintenance.status') { const job = jobs[String(payload.requestId)]; if (!job) throw new Error('未找到维护任务'); return job }
    if (method === 'maintenance.start') {
      const id = String(payload.requestId ?? ''), kind = String(payload.kind ?? '')
      if (!/^[a-zA-Z0-9-]{8,64}$/.test(id) || !['compact', 'fact-add', 'fact-forget'].includes(kind)) throw new Error('无效维护任务')
      if (jobs[id]) return jobs[id]
      if (Object.values(jobs).some(job => job.status === 'running')) throw new Error('已有维护任务正在进行')
      const job: Job = jobs[id] = { id, kind, status: 'running' }
      // Bound completed task history; in-flight work is retained until shutdown drains it.
      for (const old of Object.keys(jobs).slice(0, -50)) if (jobs[old].status !== 'running') delete jobs[old]
      saveJobs()
      const task = Promise.resolve().then(async () => {
        const currentStory = await app.interlude.findStory(current)
        if (!currentStory) throw new Error('故事已变更')
        if (kind === 'compact') return app.interlude.compactStory(currentStory)
        const scope = String(payload.scope || 'event')
        if (!['character', 'world', 'relationship', 'event', 'promise'].includes(scope)) throw new Error('无效事实类型')
        const factId = Number(payload.id)
        if (kind === 'fact-forget' && (!Number.isSafeInteger(factId) || factId <= 0)) throw new Error('无效事实编号')
        return app.interlude.mobileManageFact(currentStory, kind === 'fact-add' ? 'add' : 'forget', scope as 'event', String(payload.content ?? ''), factId)
      }).then(result => { job.status = 'done'; job.result = result }, error => { job.status = 'failed'; job.error = error instanceof Error ? error.message : '维护失败' }).finally(() => { saveJobs(); work.delete(task) })
      work.add(task)
      return job
    }
    if (method === 'health') return { hds: HDS.version, storyId: story.id, platform: bot.platform, sqlite: true }
    if (method === 'messages.history') return (await app.database.get('mobile_message' as never, {} as never, { limit: 200, sort: { occurredAt: 'desc' } } as never)).reverse().map(row => ({ ...row, images: messageImages((row as { images?: unknown }).images) }))
    if (method === 'story.snapshot') { const active = await app.interlude.findStory(current); return { story: active, entries: await app.interlude.recentEntries(story.id, 80), facts: await app.interlude.adminFacts(story.id, 30), memories: await app.interlude.memories(story.id, 20), promptTrace } }
    if (method === 'story.pause' || method === 'story.resume') {
      const paused = method.endsWith('pause')
      if (!paused && restoreHeld) { restoreHeld = false; unlinkSync(restoreMarker); await app.interlude.setDesktopRuntimePhase('running') }
      story = await app.interlude.setStatus(story, paused ? 'paused' : 'active'); return { status: paused ? 'paused' : 'active' }
    }
    if (method === 'messages.sendLocal') {
      const id = String(payload.requestId ?? '')
      const content = String(payload.content ?? '').trim()
      const imageIds = payload.images === undefined ? [] : payload.images
      if (!Array.isArray(imageIds) || imageIds.length > 3 || !imageIds.every(value => typeof value === 'string')) throw new Error('最多附加 3 张图片')
      const images = (imageIds as string[]).map(value => media.get(value))
      if (images.length && !config.model.vision?.enabled) throw new Error('请在模型设置中开启主模型识图，并选择支持图片的模型；重启后生效')
      if (!/^[a-zA-Z0-9-]{8,64}$/.test(id) || (!content && !images.length) || content.length > 12000) throw new Error('Invalid requestId or message')
      const signature = images.length ? JSON.stringify({ content, images: imageIds }) : content
      const run = async () => {
        const old = (await app.database.get('mobile_request' as never, { id } as never))[0] as { content: string; status: string } | undefined
        if (old && old.content !== signature) throw new Error('requestId conflicts with another message')
        if (old?.status === 'accepted') return { requestId: id, accepted: true, duplicate: true }
        if (!old) await app.database.create('mobile_request' as never, { id, content: signature, status: 'receiving', occurredAt: new Date() } as never)
        const accepted = await app.interlude.receive(session(id, content, images))
        if (!accepted) throw new Error('故事未接受消息；如果已暂停，请先在见闻恢复故事')
        const visible = await app.database.get('mobile_message' as never, { id } as never)
        if (!visible.length) await app.database.create('mobile_message' as never, { id, direction: 'user', content, images: imageIds, occurredAt: new Date(), status: 'accepted' } as never)
        await app.database.set('mobile_request' as never, { id } as never, { status: 'accepted' } as never)
        return { requestId: id, accepted: true }
      }
      const result = queue.then(run)
      queue = result.then(() => {}, () => {})
      return result
    }
    throw new Error('Unknown or disallowed method')
  }
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    const auth = Buffer.from(request.headers.authorization ?? '')
    const expected = Buffer.from(`Bearer ${input.token}`)
    if (request.headers.host !== `127.0.0.1:${input.port}` || request.headers.origin || auth.length !== expected.length || !timingSafeEqual(auth, expected)) { response.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' })); return }
    if (request.method !== 'POST' || request.url !== '/rpc') { response.writeHead(404).end('{}'); return }
    try {
      let body = '', bytes = 0
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 1024 * 1024) throw new Error('Request exceeds 1 MiB'); body += chunk.toString('utf8') }
      const data = JSON.parse(body)
      response.end(JSON.stringify({ data: await dispatch(data.method, data.payload ?? {}) }))
    } catch (error) { response.writeHead(400).end(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed' })) }
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(input.port, '127.0.0.1', () => resolve()) })
  let shutdown: Promise<void> | undefined
  const stop = () => shutdown ??= (async () => { closing = true; await new Promise<void>(resolve => server.close(() => resolve())); await qq?.close(); await queue; await Promise.allSettled([...work]); bot.dispose(); await app.interlude.mobileDrainBeforeStop(); await app.stop() })()
  return { app, bot, server, stop, dispatch, qq }
}

if (process.env.HDS_MOBILE_MAIN === '1') {
  const lines = createInterface({ input: process.stdin, terminal: false })
  lines.once('line', async line => {
    try {
      // Verify the actual syscall; never hide a broken runtime by overriding cwd().
      if (process.cwd() !== '/opt/hds') throw new Error('Unexpected guest working directory')
      console.log('HDS runtime check: Node cwd OK; initializing Koishi / SQLite')
      const host = await startHost(JSON.parse(line))
      console.log('HDS_MOBILE_READY')
      const shutdown = async () => { await host.stop(); await new Promise<void>(resolve => process.stdout.write('HDS_MOBILE_CLEAN_STOP\n', () => resolve())); process.exit(0) }
      lines.on('line', command => { if (command === 'STOP') void shutdown() })
      process.on('SIGTERM', () => void shutdown())
      process.on('SIGINT', () => void shutdown())
    } catch (error) { console.error('HDS startup failed:', error instanceof Error ? error.message : 'unknown'); process.exit(1) }
  })
}
