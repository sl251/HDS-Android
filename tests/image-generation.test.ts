import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultExperience } from '../packages/contracts/experience'
import { imageApi, imageResponse, imageResult, imageSize, boundedResponse, mediaFailure } from '../runtime/image-provider'
import { mediaJobs } from '../runtime/media-jobs'
import { normalizeExperience } from '../runtime/experience-config'
import { MessageDiagnostics, runMessageDiagnostics } from '../runtime/message-diagnostics'
import { aggregateDiagnosticMessages, visibleDiagnosticMessages } from '../apps/mobile-ui/message-diagnostics'

const bytes = Buffer.from([255, 216, 255, 217]), base64 = bytes.toString('base64')
const uri = `data:image/jpeg;base64,${base64}`, assetId = 'a'.repeat(64)
const waitFor = async (check: () => boolean) => {
  const end = Date.now() + 10000
  while (!check()) { assert.ok(Date.now() < end, 'media task should settle'); await new Promise(resolve => setTimeout(resolve, 20)) }
}
function fixture(t: any, overrides: Record<string, any> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'hds-image-generation-'))
  const config = defaultExperience()
  config.image = { enabled: true, provider: 'compatible', endpoint: 'https://provider.test/v1', model: 'gpt-image-1', apiKey: 'PRIVATE_KEY' }
  const diagnostics = new MessageDiagnostics(join(directory, 'diagnostics.json'))
  const jobs = mediaJobs({ directory, config: () => config, diagnostics, getImage: () => uri, saveImage: value => { assert.deepEqual(value, bytes); return { id: assetId } }, delivered: async () => {}, ...overrides })
  t.after(async () => { await jobs.stop(); rmSync(directory, { recursive: true, force: true }) })
  return { jobs, config, diagnostics, directory, create: () => jobs.create({ id: 'image-test-operation', kind: 'image', purpose: 'chat', prompt: 'PRIVATE_PROMPT' }) }
}

test('image response parser handles Imagefree, nested images, Markdown, chat arrays and Gemini multipart', () => {
  const url = 'https://cdn.test/result.png'
  for (const value of [{ status: 'completed', image: url }, { data: { result: { images: [url] } } }, `![image](${url})`, { choices: [{ message: { images: [{ image_url: { url } }] } }] }]) assert.equal(imageResult(value).url, url)
  for (const value of [uri, { data: [{ b64_json: base64 }] }, { choices: [{ message: { content: [{ type: 'text', text: 'done' }, { type: 'image_url', image_url: { url: uri } }] } }] }, { candidates: [{ content: { parts: [{ text: 'done' }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] } }] }, { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/jpeg', data: base64 } }] } }] }]) assert.deepEqual(imageResult(value).bytes, bytes)
  assert.equal(imageResult({ id: 'chatcmpl-completed', object: 'chat.completion', choices: [{ message: { content: 'no image' } }] }).taskId, undefined)
  assert.equal(imageResult({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }).reason, 'image_blocked')
  assert.equal(imageResult({ status: 'failed' }).failed, true)
})

test('SSE image responses join deltas and reject truncated or malformed streams', () => {
  const sse = ['![image](', uri, ')'].map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join('')
  assert.deepEqual(imageResponse(Buffer.from(sse + 'data: [DONE]\n\n'), 'text/event-stream').bytes, bytes)
  assert.throws(() => imageResponse(Buffer.from(sse), 'text/event-stream'), /响应格式/)
  assert.throws(() => imageResponse(Buffer.from('data: broken\n\ndata: [DONE]\n\n'), 'text/event-stream'), /响应格式/)
})

test('automatic protocol selection honors explicit endpoints and manual overrides; image sizes match models', () => {
  const connection = { enabled: true, provider: 'compatible' as const, endpoint: 'https://provider.test/v1', model: 'gemini-3.1-flash-image' }
  assert.equal(imageApi(connection), 'chat')
  assert.equal(imageApi({ ...connection, endpoint: 'https://generativelanguage.googleapis.com/v1beta' }), 'gemini')
  assert.equal(imageApi({ ...connection, endpoint: 'https://provider.test/v1/images/generations' }), 'images')
  assert.equal(imageApi({ ...connection, imageApi: 'images' }), 'images')
  assert.equal(imageApi({ ...connection, model: 'gpt-image-1' }), 'images')
  assert.equal(imageSize('dall-e-2', '9:16'), '1024x1024')
  assert.equal(imageSize('dall-e-3', '9:16'), '1024x1792')
  assert.equal(imageSize('gpt-image-1', '16:9'), '1536x1024')
  for (const imageApi of ['auto', 'images', 'chat', 'gemini'] as const) assert.equal(normalizeExperience({ image: { ...connection, imageApi } }).image.imageApi, imageApi)
  assert.equal(normalizeExperience({ image: connection }).image.imageApi, 'auto')
})

test('HTTP, embedded errors, malformed JSON and oversized responses have safe classified errors', async () => {
  for (const [status, reason] of [[400, 'invalid_request'], [401, 'authentication'], [402, 'provider_quota'], [403, 'permission'], [404, 'media_route'], [405, 'media_route'], [429, 'throttled_or_quota'], [500, 'provider_error']] as const) {
    await assert.rejects(boundedResponse(new Response('PRIVATE_PROVIDER_BODY PRIVATE_KEY', { status })), (error: any) => error.reason === reason && error.status === status && !error.message.includes('PRIVATE_'))
  }
  assert.equal(mediaFailure({ error: { code: 401 } }).reason, 'authentication')
  assert.equal(imageResponse(Buffer.from(JSON.stringify({ error: { message: 'insufficient_quota' } }))).reason, 'provider_quota')
  assert.throws(() => imageResponse(Buffer.from('invalid JSON')), /响应格式/)
  await assert.rejects(boundedResponse(new Response('oversize'), 2), (error: any) => error.reason === 'media_size')
})

for (const api of ['images', 'chat', 'gemini'] as const) test(`${api} sends reference images using its protocol and delivers the result once`, async t => {
  let posts = 0, deliveries = 0
  const f = fixture(t, { delivered: async () => { deliveries++ }, fetch: async (url: string, init: RequestInit) => {
    posts++
    if (api === 'images') { assert.match(url, /\/images\/edits$/); assert.ok(init.body instanceof FormData); assert.ok(init.body.get('image[]') instanceof Blob) }
    else {
      const body = JSON.parse(String(init.body))
      if (api === 'chat') { assert.match(url, /\/chat\/completions$/); assert.equal(body.stream, false); assert.equal(body.messages[0].content[1].image_url.url, uri) }
      else { assert.match(url, /\/models\/test-image:generateContent$/); assert.equal((init.headers as any)['x-goog-api-key'], 'PRIVATE_KEY'); assert.equal(body.contents[0].parts[1].inlineData.data, base64) }
    }
    return Response.json(api === 'chat' ? { choices: [{ message: { content: `![image](${uri})` } }] } : api === 'gemini' ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }] } }] } : { data: [{ b64_json: base64 }] })
  } })
  Object.assign(f.config.image, { imageApi: api, model: 'test-image', referenceImages: true })
  f.config.visual.references = [assetId]
  f.create(); f.create()
  await waitFor(() => !!f.jobs.list()[0].delivered)
  f.jobs.retry('image-test-operation')
  assert.equal(posts, 1); assert.equal(deliveries, 1)
  assert.doesNotMatch(readFileSync(join(f.directory, 'diagnostics.json'), 'utf8'), /PRIVATE_|data:image|provider\.test/)
})

test('Imagefree queued task consumes completed.image and stops polling after saving and delivery', async t => {
  let posts = 0, polls = 0, downloads = 0
  const f = fixture(t, { fetch: async (url: string, init: RequestInit) => {
    if (init?.method === 'POST') { posts++; return Response.json({ taskId: 'imagefree-task' }) }
    if (url.includes('/status?')) { polls++; return Response.json(polls === 1 ? { status: 'queued' } : { status: 'completed', image: 'https://cdn.test/result.jpg' }) }
    downloads++; return new Response(bytes)
  } })
  f.config.image.provider = 'imagefree'; f.create()
  await waitFor(() => !!f.jobs.list()[0].delivered)
  assert.equal(posts, 1); assert.equal(polls, 2); assert.equal(downloads, 1)
  assert.deepEqual([...new Set(f.diagnostics.list().events.map(event => event.mediaPhase))], ['prepare', 'submit', 'poll', 'download', 'save', 'deliver'])
})

test('explicit refusal retries with corrected config; uncertain submission cannot generate again', async t => {
  let posts = 0
  const f = fixture(t, { fetch: async () => ++posts === 1 ? new Response('', { status: 401 }) : Response.json({ data: [{ b64_json: base64 }] }) })
  f.create(); await waitFor(() => f.jobs.list()[0].status === 'failed')
  f.config.image.imageApi = 'chat'; f.jobs.retry('image-test-operation')
  await waitFor(() => !!f.jobs.list()[0].delivered); assert.equal(posts, 2)
  const uncertain = fixture(t, { fetch: async () => { throw new Error('network disconnected PRIVATE_KEY') } })
  uncertain.create(); await waitFor(() => uncertain.jobs.list()[0].status === 'unknown')
  assert.throws(() => uncertain.jobs.retry('image-test-operation'), /不能安全重复生成/)
  assert.doesNotMatch(JSON.stringify(uncertain.diagnostics.list()), /PRIVATE_/)
})

test('delivery retry uses the saved image and never submits another generation', async t => {
  let posts = 0, deliveries = 0
  const f = fixture(t, { fetch: async () => { posts++; return Response.json({ data: [{ b64_json: base64 }] }) }, delivered: async () => { if (++deliveries === 1) throw new Error('PRIVATE_DELIVERY') } })
  f.create(); await waitFor(() => !!f.jobs.list()[0].error)
  assert.equal(f.jobs.list()[0].status, 'ready')
  f.jobs.retry('image-test-operation'); await waitFor(() => !!f.jobs.list()[0].delivered)
  assert.equal(posts, 1); assert.equal(deliveries, 2)
})

for (const scenario of ['empty', 'malformed', 'embedded-error', 'unsupported-async', 'download', 'save', 'timeout'] as const) test(`image ${scenario} failure records its stage without exposing provider content or resubmitting`, async t => {
  let posts = 0
  const f = fixture(t, { fetch: async (_url: string, init: RequestInit) => {
    if (init?.method !== 'POST') throw new Error('network download failure PRIVATE_KEY')
    posts++
    if (scenario === 'empty') return Response.json({ data: [] })
    if (scenario === 'malformed') return new Response('PRIVATE_BAD_JSON')
    if (scenario === 'embedded-error') return Response.json({ error: { message: 'insufficient_quota PRIVATE_KEY' } })
    if (scenario === 'unsupported-async') return Response.json({ task_id: 'remote-task' })
    if (scenario === 'download') return Response.json({ data: [{ url: 'https://cdn.test/PRIVATE_URL.jpg' }] })
    if (scenario === 'timeout') throw new DOMException('PRIVATE_TIMEOUT', 'TimeoutError')
    return Response.json({ data: [{ b64_json: base64 }] })
  }, ...(scenario === 'save' ? { saveImage: () => { throw new Error('PRIVATE_DISK_ERROR') } } : {}) })
  f.create(); await waitFor(() => ['failed', 'unknown'].includes(f.jobs.list()[0].status))
  const event = f.diagnostics.list().events.at(-1)!
  const reason = { empty: 'image_empty', malformed: 'image_response', 'embedded-error': 'provider_quota', 'unsupported-async': 'image_async', download: 'network', save: 'image_save', timeout: 'timeout' }[scenario]
  assert.equal(event.reason, reason)
  assert.equal(event.mediaPhase, scenario === 'download' ? 'download' : scenario === 'save' ? 'save' : scenario === 'unsupported-async' ? 'poll' : 'submit')
  assert.equal(posts, 1)
  assert.doesNotMatch(JSON.stringify(f.diagnostics.list()), /PRIVATE_/)
})

test('completed image retains its original message association after diagnostic scope closes', async t => {
  const f = fixture(t, { fetch: async () => Response.json({ data: [{ b64_json: base64 }] }) })
  runMessageDiagnostics(f.diagnostics, ['original-message'], f.create)
  await waitFor(() => !!f.jobs.list()[0].delivered)
  const events = f.diagnostics.list('original-message').events
  assert.ok(events.some(event => event.mediaPhase === 'deliver' && event.outcome === 'succeeded'))
  assert.ok(events.every(event => event.requestIds.includes('original-message')))
})

test('restart resumes a submitted Imagefree job by querying without a new generation', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'hds-image-resume-'))
  writeFileSync(join(directory, 'media-jobs.json'), JSON.stringify({ jobs: [{ id: 'resumed-image-task', kind: 'image', purpose: 'avatar', status: 'running', at: new Date().toISOString(), providerTaskId: 'remote-task', submission: true }] }))
  const f = fixture(t, { directory, fetch: async (_url: string, init: RequestInit) => { assert.notEqual(init?.method, 'POST'); return Response.json({ status: 'completed', image: uri }) } })
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  f.config.image.provider = 'imagefree'
  await waitFor(() => !!f.jobs.list()[0]?.delivered)
})

test('diagnostics remain correlated after the originating scope ends and clear suppresses in-flight events', async t => {
  let release!: (value: Response) => void
  const f = fixture(t, { fetch: async () => new Promise<Response>(resolve => { release = resolve }) })
  runMessageDiagnostics(f.diagnostics, ['original-message'], f.create)
  await waitFor(() => !!release)
  assert.ok(f.diagnostics.list('original-message').events.some(event => event.mediaPhase === 'submit'))
  f.diagnostics.clear(); release(Response.json({ data: [{ b64_json: base64 }] }))
  await waitFor(() => !!f.jobs.list()[0].delivered)
  assert.deepEqual(f.diagnostics.list().events, [])
})

test('failed avatar and feed image jobs are visible without a chat message and support task filtering', async t => {
  const f = fixture(t, { fetch: async () => new Response('captcha required PRIVATE_PROMPT', { status: 403 }) })
  f.jobs.create({ id: 'avatar-failure-task', kind: 'image', purpose: 'avatar', prompt: 'PRIVATE_PROMPT' })
  await waitFor(() => f.jobs.list()[0].status === 'failed')
  f.jobs.create({ id: 'feed-failure-task', kind: 'image', purpose: 'feed', prompt: 'PRIVATE_PROMPT' })
  await waitFor(() => f.jobs.list()[1].status === 'failed')
  const cards = aggregateDiagnosticMessages(f.diagnostics.list().events)
  assert.equal(visibleDiagnosticMessages(cards, 'failed').length, 2)
  assert.ok(cards.some(card => card.preview.startsWith('头像生成')))
  assert.ok(cards.some(card => card.preview.startsWith('动态配图')))
  assert.ok(f.diagnostics.list('avatar-failure-task').events.every(event => event.mediaJobId === 'avatar-failure-task'))
  assert.doesNotMatch(JSON.stringify(f.diagnostics.list()), /PRIVATE_|captcha/)
})
