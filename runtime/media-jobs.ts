import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atomicState } from './atomic-state'
import { imagePrompt } from './experience-config'
import type { ExperienceSettings, MediaConnection, MediaJob } from '../packages/contracts/experience'

type Job = MediaJob & { route?: Omit<MediaConnection, 'apiKey'>; references?: string[]; ratio?: string; submission?: boolean }
const limit = 16 * 1024 * 1024
export async function boundedResponse(response: Response, max = limit) {
  if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`)
  if (Number(response.headers.get('content-length')) > max) throw new Error('返回内容过大')
  if (!response.body) throw new Error('服务返回空内容')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error('返回内容过大'); chunks.push(value) } }
  finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks)
}
export function imageResult(value: any): { taskId?: string; url?: string; bytes?: Buffer; failed?: boolean } {
  if (!value || typeof value !== 'object') return {}
  if (['failed', 'error', 'cancelled'].includes(String(value.status).toLowerCase()) || value.success === false) return { failed: true }
  const taskId = value.taskId ?? value.task_id ?? value.id
  for (const key of ['imageUrl', 'image_url', 'url']) {
    if (typeof value[key] === 'string') {
      const uri = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value[key])
      if (uri) return { bytes: Buffer.from(uri[1], 'base64') }
      if (/^https?:\/\//.test(value[key])) return { url: value[key], taskId }
    }
  }
  for (const key of ['b64_json', 'base64']) if (typeof value[key] === 'string' && value[key].length <= limit * 1.4) return { bytes: Buffer.from(value[key], 'base64') }
  for (const key of ['data', 'result', 'output', 'images']) {
    const nested = Array.isArray(value[key]) ? value[key][0] : value[key]
    if (nested && nested !== value) { const result = imageResult(nested); if (Object.keys(result).length) return { taskId, ...result } }
  }
  return typeof taskId === 'string' && taskId.length <= 256 ? { taskId } : {}
}
export function mediaEndpoint(base: string, suffix: string) {
  const url = new URL(base)
  const path = url.pathname.replace(/\/$/, '').replace(/\/(?:chat\/completions|audio\/transcriptions|images\/(?:generations|edits))$/, '')
  url.pathname = `${path || '/v1'}/${suffix}`
  return url.href
}
export function mediaJobs(options: { directory: string; identity?: string; audioDirectory?: string; config: () => ExperienceSettings; getImage: (id: string) => string; saveImage: (bytes: Buffer) => { id: string }; delivered: (job: MediaJob) => Promise<void>; fetch?: typeof fetch }) {
  const db = atomicState<{ jobs: Job[] }>(join(options.directory, 'media-jobs.json'), () => ({ jobs: [] }))
  const request = options.fetch ?? fetch
  let stopped = false
  const active = new Map<string, AbortController>()
  const tasks = new Set<Promise<unknown>>()
  const track = (task: Promise<unknown>) => { tasks.add(task); void task.then(() => tasks.delete(task), () => tasks.delete(task)) }
  const update = (id: string, change: Partial<Job>) => db.change(s => { const job = s.jobs.find(j => j.id === id); if (!job) throw new Error('任务不存在'); Object.assign(job, change); return { ...job } })
  db.change(s => { for (const job of s.jobs) if (['running', 'submitted'].includes(job.status)) job.status = job.providerTaskId || job.imageUrl ? 'submitted' : job.submission ? 'unknown' : 'queued' })
  const publicJob = ({ route, references, ratio, submission, ...job }: Job): MediaJob => job
  const run = async (initial: Job) => {
    if (stopped || active.has(initial.id)) return
    const controller = new AbortController(); active.set(initial.id, controller)
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240000)])
    const current = initial.kind === 'image' ? options.config().image : options.config().stt
    try {
      if (!current.enabled) throw new Error('对应媒体服务未开启')
      if (initial.route && (initial.route.endpoint !== current.endpoint || initial.route.provider !== current.provider || initial.route.model !== current.model)) throw new Error('任务原服务配置已改变，请恢复配置后重试')
      let job = update(initial.id, { status: 'running', error: undefined })
      const headers = current.apiKey ? { Authorization: `Bearer ${current.apiKey}` } : {}
      if (job.kind === 'stt') {
        if (!options.audioDirectory || !/^[a-f0-9]{64}$/.test(job.audioId ?? '')) throw new Error('录音不存在')
        const bytes = readFileSync(join(options.audioDirectory, `${job.audioId}.wav`))
        if (bytes.length > 10 * 1024 * 1024) throw new Error('录音过大')
        const body = new FormData(); body.append('file', new Blob([new Uint8Array(bytes)]), 'recording.wav'); body.append('model', current.model)
        update(job.id, { submission: true })
        const response = await request(mediaEndpoint(current.endpoint, 'audio/transcriptions'), { method: 'POST', headers, body, signal, redirect: 'error' })
        if ([400, 401, 402, 403, 422, 429].includes(response.status)) update(job.id, { submission: false })
        const data = JSON.parse((await boundedResponse(response, 1024 * 1024)).toString())
        update(job.id, { submission: false })
        if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 12000) throw new Error('未识别到有效文字')
        job = update(job.id, { text: data.text.trim(), status: 'ready', submission: false })
      } else {
        let result: ReturnType<typeof imageResult> = { taskId: job.providerTaskId, url: job.imageUrl }
        if (!result.taskId && !result.url) {
          let body: FormData | string, endpoint: string, contentHeaders: Record<string, string> = {}
          if (current.provider === 'imagefree') {
            endpoint = 'https://imagefree.net/api/generate'; body = JSON.stringify({ prompt: job.prompt, aspect_ratio: job.ratio, turnstile_token: null }); contentHeaders = { 'Content-Type': 'application/json' }
          } else if (job.references?.length && current.referenceImages) {
            endpoint = mediaEndpoint(current.endpoint, 'images/edits')
            const form = new FormData(); form.append('model', current.model); form.append('prompt', job.prompt!); form.append('n', '1')
            for (const id of job.references) { const uri = options.getImage(id); const [meta, content] = uri.split(','); form.append('image[]', new Blob([Buffer.from(content, 'base64')], { type: meta.slice(5).split(';')[0] }), `${id}.png`) }
            body = form
          } else {
            endpoint = mediaEndpoint(current.endpoint, 'images/generations'); contentHeaders = { 'Content-Type': 'application/json' }
            const size = job.ratio === '1:1' ? '1024x1024' : ['3:4', '9:16'].includes(job.ratio!) ? '1024x1536' : '1536x1024'
            body = JSON.stringify({ model: current.model, prompt: job.prompt, n: 1, size })
          }
          update(job.id, { submission: true })
          const response = await request(endpoint, { method: 'POST', headers: { ...headers, ...contentHeaders }, body, signal, redirect: 'error' })
          // Explicit server refusal is safe to retry after configuration is fixed.
          if (!response.ok && [400, 401, 402, 403, 422, 429].includes(response.status)) { update(job.id, { submission: false }); throw new Error(`生图服务拒绝请求（HTTP ${response.status}）`) }
          const bytes = await boundedResponse(response)
          result = response.headers.get('content-type')?.startsWith('image/') ? { bytes } : imageResult(JSON.parse(bytes.toString()))
          if (result.taskId) update(job.id, { providerTaskId: result.taskId, status: 'submitted' })
          if (result.url) update(job.id, { imageUrl: result.url })
          if (!result.taskId && !result.url && !result.bytes && !result.failed) throw new Error('提交结果无法确认；请勿重复生成')
        }
        while (result.taskId && !result.bytes && !result.url && !result.failed) {
          if (current.provider !== 'imagefree') throw new Error('此兼容接口返回异步任务，但未提供受支持的查询协议')
          await new Promise<void>((resolve, reject) => { const abort = () => { clearTimeout(timer); reject(new Error('任务等待中断')) }; const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 3000); if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }) })
          result = { taskId: result.taskId, ...imageResult(JSON.parse((await boundedResponse(await request(`https://imagefree.net/api/generate/status?taskId=${encodeURIComponent(result.taskId)}`, { signal }), 1024 * 1024)).toString())) }
        }
        if (result.failed) { update(job.id, { submission: false, providerTaskId: undefined, imageUrl: undefined }); throw new Error('生图服务报告任务失败') }
        if (result.url) {
          const url = new URL(result.url)
          if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw new Error('图片下载地址不可用')
          update(job.id, { imageUrl: result.url })
          result.bytes = await boundedResponse(await request(result.url, { signal, redirect: 'error' }))
        }
        if (!result.bytes) throw new Error('没有获得图片')
        const asset = options.saveImage(result.bytes)
        job = update(job.id, { imageId: asset.id, status: 'ready', submission: false })
      }
      if (!stopped && !job.delivered) { await options.delivered(publicJob(job)); update(job.id, { delivered: true }) }
    } catch (error) {
      const job = db.read().jobs.find(j => j.id === initial.id)!
      if (job.status === 'ready') update(job.id, { error: '媒体已完成，投递失败，可重试投递' })
      else update(job.id, { status: job.submission && !job.providerTaskId && !job.imageUrl ? 'unknown' : 'failed', error: signal.aborted ? '任务超时或已停止；已有任务可继续查询' : String((error as Error).message).slice(0, 240) })
    } finally { active.delete(initial.id) }
  }
  const timer = setInterval(() => {
    if (stopped || active.size) return
    const job = db.read().jobs.find(j => ['queued', 'submitted'].includes(j.status) || j.status === 'ready' && !j.delivered && !j.error)
    if (job?.status === 'ready') { active.set(job.id, new AbortController()); track(options.delivered(publicJob(job)).then(() => update(job.id, { delivered: true })).catch(() => update(job.id, { error: '媒体投递失败' })).finally(() => active.delete(job.id))) }
    else if (job) track(run(job))
  }, 500)
  return {
    list: () => db.read().jobs.slice(-100).map(publicJob),
    create(input: Partial<MediaJob> & { id: string; kind: 'image' | 'stt'; purpose: MediaJob['purpose'] }) {
      if (!/^[\w:-]{8,160}$/.test(input.id)) throw new Error('媒体任务编号无效')
      const old = db.read().jobs.find(j => j.id === input.id); if (old) return publicJob(old)
      const config = options.config(), route = input.kind === 'image' ? config.image : config.stt
      if (!route.enabled) throw new Error('请先在设置中开启对应媒体服务')
      if (db.read().jobs.some(j => ['queued', 'submitted', 'running'].includes(j.status) && j.kind === input.kind)) throw new Error('已有同类任务正在处理')
      if (input.kind === 'image' && (!input.prompt?.trim() || input.prompt.length > 3000)) throw new Error('请填写不超过 3000 字的画面描述')
      if (input.kind === 'stt' && (!/^[a-f0-9]{64}$/.test(input.audioId ?? '') || !Number.isFinite(input.duration) || input.duration! <= 0 || input.duration! > 180)) throw new Error('录音参数无效')
      const { apiKey, ...publicRoute } = route
      const job: Job = { id: input.id, kind: input.kind, purpose: input.purpose, at: new Date().toISOString(), status: 'queued', route: publicRoute, prompt: input.kind === 'image' ? imagePrompt({ ...config, visual: { ...config.visual, appearance: config.visual.appearance || options.identity || '' } }, input.prompt!) : undefined, caption: String(input.caption ?? '').slice(0, 2000), audioId: input.audioId, duration: input.duration, ratio: input.purpose === 'avatar' ? '1:1' : config.visual.ratio, references: [...config.visual.references] }
      db.change(s => { if (s.jobs.length >= 500) s.jobs = s.jobs.filter(j => !j.delivered).concat(s.jobs.filter(j => j.delivered).slice(-200)); s.jobs.push(job) })
      return publicJob(job)
    },
    retry(id: string) {
      const job = db.read().jobs.find(j => j.id === id)
      if (!job) throw new Error('任务不存在')
      if (active.has(id) || ['queued', 'running', 'submitted'].includes(job.status)) return
      if (job.status === 'unknown') throw new Error('提交结果未知，不能安全重复生成；请先在服务端确认')
      update(id, { status: job.status === 'ready' ? 'ready' : 'queued', error: undefined })
    },
    async stop() { stopped = true; clearInterval(timer); for (const controller of active.values()) controller.abort(); await Promise.allSettled([...tasks]) },
  }
}
