import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { partialReply } from '../upstream/hds-interlude/src/mobile-stream'
import { feedStore } from '../runtime/feed'
import { mediaJobs, imageResult, mediaEndpoint } from '../runtime/media-jobs'
import { defaultExperience } from '../packages/contracts/experience'
import { normalizeExperience, imagePrompt } from '../runtime/experience-config'
import { outbox } from '../apps/mobile-ui/outbox'
import { composerEnter } from '../apps/mobile-ui/composer-state'
import { experienceRuntime } from '../runtime/experience-runtime'
import { fetchWeatherSnapshot, lastWeatherSnapshot, resolveWeatherConfig } from '../upstream/hds-interlude/src/weather'
const directory = () => mkdtempSync(join(tmpdir(), 'hds-experience-'))
const waitFor = async (check: () => boolean, timeout = 6000) => { const end = Date.now() + timeout; while (!check()) { assert.ok(Date.now() < end, 'task should settle'); await new Promise(r => setTimeout(r, 20)) } }

test('partial reply exposes only immediate visible content, holds incomplete escapes and rejects duplicate keys', () => {
  const start = '{"script":"PRIVATE_SCRIPT","interaction":{"reply":{"mode":"immediate","content":"'
  assert.equal(partialReply(start + '你好'), '你好')
  assert.equal(partialReply(start + '你\\uD83D'), '你')
  assert.equal(partialReply(start + '你\\uD83D\\uDE00'), '你😀')
  assert.equal(partialReply(start + '你好\\'), '你好')
  assert.equal(partialReply(start + '你好<sep/>第二段'), '你好')
  assert.equal(partialReply('{"script":"SECRET'), undefined)
  assert.equal(partialReply('{"interaction":{"reply":{"mode":"none","content":"隐私'), undefined)
  assert.equal(partialReply('{"interaction":{"reply":{"mode":"immediate","mode":"none","content":"隐私'), undefined)
})

test('feed mutations are durable, story scoped and deduplicate retries; likes and unlikes are explicit knowledge', () => {
  const path = directory(), feed = feedStore(path), other = feedStore(directory())
  feed.mutate('user', 'post', { content: '今天晴天' }, 'post-operation-1')
  feed.mutate('user', 'post', { content: '今天晴天' }, 'post-operation-1')
  feed.mutate('character', 'comment', { postId: 'post-operation-1', content: '出去走走？' }, 'comment-operation-1')
  feed.mutate('user', 'like', { postId: 'post-operation-1', enabled: true }, 'like-operation-1')
  assert.equal(feed.list().length, 1); assert.equal(feed.context().posts[0].userLiked, true)
  feed.observe(feed.context().through)
  feed.mutate('user', 'like', { postId: 'post-operation-1', enabled: false }, 'like-operation-2')
  assert.equal(feed.context().changes.length, 1); assert.equal(feed.context().changes[0].kind, '取消点赞')
  assert.equal(feedStore(path).list()[0].comments.length, 1)
  assert.throws(() => other.mutate('user', 'like', { postId: 'post-operation-1' }, 'foreign-operation'), /当前故事/)
  assert.throws(() => feed.mutate('character', 'delete', { postId: 'post-operation-1' }, 'delete-operation'), /自己的/)
})

test('outbox survives reload without changing IDs and keeps stories separate; Enter respects IME and chosen behavior', () => {
  const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
  outbox(storage).put('alice', { id: 'original-request', content: '你好', direction: 'user', occurredAt: new Date().toISOString(), status: 'sending' })
  assert.equal(outbox(storage).read('alice')[0].status, 'unknown'); assert.equal(outbox(storage).read('bob').length, 0)
  outbox(storage).remove('alice', ['original-request']); assert.equal(outbox(storage).read('alice').length, 0)
  assert.equal(composerEnter({ key: 'Enter' }, false, 'newline'), 'newline')
  assert.equal(composerEnter({ key: 'Enter', ctrlKey: true }, false, 'newline'), 'send')
  assert.equal(composerEnter({ key: 'Enter', ctrlKey: true, keyCode: 229 }, false, 'newline'), 'composition')
})

test('image tasks persist one submission and delivery; style and reference configuration are snapshotted without secrets', async () => {
  const path = directory(), config = defaultExperience(); config.image = { enabled: true, provider: 'compatible', endpoint: 'https://provider.test/v1', model: 'image', apiKey: 'PRIVATE_KEY' }; config.visual.appearance = '红发绿眼'; config.visual.style = '水彩';
  let posts = 0, deliveries = 0
  const jobs = mediaJobs({ directory: path, config: () => config, getImage: () => '', saveImage: bytes => { assert.equal(bytes.toString(), 'fixture'); return { id: 'a'.repeat(64) } }, delivered: async () => { deliveries++ }, fetch: async (url, init) => { posts++; assert.equal(String(url), 'https://provider.test/v1/images/generations'); assert.match(String(init?.body), /红发绿眼/); assert.match(String(init?.body), /水彩/); return Response.json({ data: [{ b64_json: Buffer.from('fixture').toString('base64') }] }) } })
  try {
    jobs.create({ id: 'image-operation-1', kind: 'image', purpose: 'chat', prompt: '窗边自拍' }); jobs.create({ id: 'image-operation-1', kind: 'image', purpose: 'chat', prompt: '窗边自拍' })
    await waitFor(() => !!jobs.list()[0].delivered); assert.equal(posts, 1); assert.equal(deliveries, 1)
    assert.doesNotMatch(readFileSync(join(path, 'media-jobs.json'), 'utf8'), /PRIVATE_KEY/)
    jobs.retry('image-operation-1'); await new Promise(r => setTimeout(r, 600)); assert.equal(posts, 1)
  } finally { await jobs.stop() }
})

test('unknown provider acceptance never silently resubmits after a restart', async () => {
  const path = directory(), config = defaultExperience(); config.image.enabled = true; let calls = 0
  const options = { directory: path, config: () => config, getImage: () => '', saveImage: () => ({ id: 'a'.repeat(64) }), delivered: async () => {}, fetch: async () => { calls++; throw new Error('network interrupted') } }
  const jobs = mediaJobs(options)
  jobs.create({ id: 'unknown-operation', kind: 'image', purpose: 'chat', prompt: '街景' })
  await waitFor(() => jobs.list()[0].status === 'unknown'); await jobs.stop()
  const restarted = mediaJobs(options)
  try { assert.throws(() => restarted.retry('unknown-operation'), /未知/); await new Promise(r => setTimeout(r, 600)); assert.equal(calls, 1) } finally { await restarted.stop() }
})

test('avatar generation uses a square canvas without changing the character image ratio', async () => {
  const config = defaultExperience(); config.image = { enabled: true, provider: 'compatible', endpoint: 'https://provider.test/v1', model: 'portrait' }; config.visual.ratio = '9:16'
  const jobs = mediaJobs({ directory: directory(), config: () => config, getImage: () => '', saveImage: () => ({ id: 'a'.repeat(64) }), delivered: async job => { assert.equal(job.purpose, 'avatar') }, fetch: async (_, init) => { assert.equal(JSON.parse(String(init?.body)).size, '1024x1024'); return Response.json({ data: [{ b64_json: Buffer.from('fixture').toString('base64') }] }) } })
  try { jobs.create({ id: 'square-avatar-task', kind: 'image', purpose: 'avatar', prompt: '人设头像' }); await waitFor(() => !!jobs.list()[0].delivered); assert.equal(config.visual.ratio, '9:16') } finally { await jobs.stop() }
})

test('STT returns editable transcript and preserves the recording; explicit refusal permits a user retry', async () => {
  const path = directory(), id = 'a'.repeat(64), config = defaultExperience(); config.stt = { enabled: true, provider: 'compatible', endpoint: 'https://speech.test/v1', model: 'speech' }; writeFileSync(join(path, id + '.wav'), 'recording')
  let calls = 0
  const jobs = mediaJobs({ directory: path, audioDirectory: path, config: () => config, getImage: () => '', saveImage: () => ({ id }), delivered: async () => {}, fetch: async (_, init) => { assert.ok(init?.body instanceof FormData); return ++calls === 1 ? new Response('', { status: 401 }) : Response.json({ text: '今天想去散步。' }) } })
  try { jobs.create({ id: 'transcription-operation', kind: 'stt', purpose: 'voice', audioId: id, duration: 2 }); await waitFor(() => jobs.list()[0].status === 'failed'); jobs.retry('transcription-operation'); await waitFor(() => jobs.list()[0].status === 'ready'); assert.equal(jobs.list()[0].text, '今天想去散步。'); assert.equal(jobs.list()[0].audioId, id) } finally { await jobs.stop() }
})

test('interrupted stream remains recoverable while confirmed visible delivery cannot be retried', async () => {
  const path = directory(), options = { directory: path, getImage: () => '', saveImage: () => ({ id: 'a'.repeat(64) }), deliver: async () => {}, wake: async () => true }
  const runtime = experienceRuntime(options)
  runtime.stream({ id: 'turn-id-1', sourceIds: ['message-id-1'], content: '你好', status: 'streaming' }); await runtime.stop()
  const restarted = experienceRuntime(options)
  try { assert.equal(restarted.snapshot().streams[0].status, 'interrupted'); assert.equal(restarted.failedTurn('message-id-1').content, '你好'); restarted.stream({ id: 'turn-id-2', sourceIds: ['message-id-1'], content: '新的回复', status: 'streaming' }); assert.equal(restarted.takeStream('新的回复。'), 'turn-id-2'); restarted.deliveredStream('turn-id-2'); restarted.stream({ id: 'turn-id-2', sourceIds: ['message-id-1'], status: 'failed' }); assert.throws(() => restarted.failedTurn('message-id-1')) } finally { await restarted.stop() }
})

test('only committed local character decisions create images; user posts, disabled channels and low willingness do not', async () => {
  const config = defaultExperience(); config.image.enabled = true; config.visual.appearance = '红发绿眼'; config.visual.style = '水彩'
  const runtime = experienceRuntime({ directory: directory(), settings: config, getImage: () => '', saveImage: () => ({ id: 'a'.repeat(64) }), deliver: async () => {}, wake: async () => true })
  const decision = { mobileActions: [{ kind: 'image', purpose: 'feed', scene: '花店门口的自拍', content: '今天买了花。', willingness: .9 }] }
  try {
    runtime.mutate({ action: 'post', content: '我发了一条动态', operationId: 'user-feed-post-1' })
    assert.equal(runtime.snapshot().jobs.length, 0)
    await runtime.committed(decision, 1, false)
    await runtime.committed({ mobileActions: [{ ...decision.mobileActions[0], willingness: .3 }] }, 2, true)
    assert.equal(runtime.snapshot().jobs.length, 0)
    await runtime.committed(decision, 3, true)
    await runtime.committed(decision, 3, true)
    await runtime.committed(decision, 4, true)
    const snapshot = runtime.snapshot()
    assert.equal(snapshot.jobs.length, 1, 'duplicate commit and cooldown cannot create a second task')
    assert.equal(snapshot.jobs[0].purpose, 'feed'); assert.match(snapshot.jobs[0].prompt!, /红发绿眼/); assert.match(snapshot.jobs[0].prompt!, /水彩/)
    assert.equal(snapshot.posts.length, 1, 'the character post waits for its generated image')
    runtime.configure({ ...config, image: { ...config.image, enabled: false } })
    assert.doesNotMatch(runtime.context(), /"available":true/)
    await runtime.committed(decision, 5, true); assert.equal(runtime.snapshot().jobs.length, 1)
  } finally { await runtime.stop() }
})

test('media contracts validate profiles and parse supported image response shapes', () => {
  assert.equal(mediaEndpoint('https://api.test/v1/chat/completions', 'audio/transcriptions'), 'https://api.test/v1/audio/transcriptions')
  assert.equal(imageResult({ data: { task_id: 'task-a' } }).taskId, 'task-a')
  assert.equal(imageResult({ status: 'failed' }).failed, true)
  assert.throws(() => normalizeExperience({ visual: { ...defaultExperience().visual, references: ['../secret'] } }))
  assert.match(imagePrompt(defaultExperience(), '自拍'), /自拍/)
})

test('weather snapshot is scoped to resolved coordinates and never reuses another city cache', async () => {
  const ctx: any = { http: { get: async (url: string, options: any) => url.includes('geocoding') ? { results: [{ name: '同名城市', latitude: options.params.name === '城市甲' ? 10 : 20, longitude: 30 }] } : { current: { temperature_2m: options.params.latitude, weather_code: 0 } } } }
  const config = resolveWeatherConfig({ enabled: true, autoFromLocation: true } as any)
  const first = await fetchWeatherSnapshot(ctx, config, '城市甲'), second = await fetchWeatherSnapshot(ctx, config, '城市乙')
  assert.equal(first?.temperature, 10); assert.equal(second?.temperature, 20)
  assert.equal(lastWeatherSnapshot(config, '城市甲')?.temperature, 10)
  assert.equal(lastWeatherSnapshot(config, '城市乙')?.temperature, 20)
})
