import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { OpenAICompatibleNarrator, type ModelConfig } from '../upstream/hds-interlude/src/narrator'
import { emptyStorySetting, emptyStoryState, type NarrativeRequest } from '../upstream/hds-interlude/src/types'
import { mobileModelConfig } from '../runtime/model-config'
import { mobileRetryFilter } from '../runtime/model-retry'
import { visionProjection } from '../packages/contracts'

function request(): NarrativeRequest {
  const now = new Date('2026-09-15T00:00:00Z')
  return { phase: 'user-message', story: { id: 's', platform: 'onebot', selfId: 'b', userId: '', channelId: '', status: 'active', setting: emptyStorySetting(), state: emptyStoryState(), cursorAt: now, createdAt: now, updatedAt: now },
    from: now, now, participant: null, participants: [], shareParticipantDetails: false, dueIntents: [], activeConsequences: [], supersededIntents: [], recentEntries: [], memories: [], images: [], audio: [], userMessage: '你好' }
}
const response = (content = '{"script":"正文"}') => ({ choices: [{ message: { content } }] })
const httpError = (status: number, headers: unknown = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, headers } })
function fixture(post: (body: any, call: number) => unknown, options: Record<string, unknown> = {}) {
  const providers = ['first', 'second'].map(id => ({ id, label: id, model: id, preset: 'custom', protocol: 'chat-completions' as const, endpoint: 'https://example.com/v1/chat/completions', enabled: true, credentialPresent: false, useForMain: true, useForCompaction: true, useForAlter: true }))
  const config = { ...mobileModelConfig({ endpoint: '', model: '', providers, modelOptions: { failoverEnabled: true, ...options } }), fixedPrompt: '', stylePrompt: '' } as ModelConfig
  const calls: any[] = []
  const narrator = new OpenAICompatibleNarrator({ http: { post: async (url: string, body: any, transport: any) => {
    calls.push({ url, body, transport }); return post(body, calls.length)
  } } } as any, config, true)
  return { narrator, config, calls, cooldown: (narrator as any).cooldownUntil as Map<string, number> }
}

test('P0 timeout retries once and succeeds with identical payload; defaults and vision agree', async () => {
  const f = fixture((_body, call) => { if (call === 1) throw new Error('request timeout'); return response() })
  assert.equal((await f.narrator.decide(request())).script, '正文')
  assert.equal(f.config.mainTimeout, 90000)
  assert.equal(f.config.mobileTurnDeadlineMs, 240000)
  assert.equal(f.config.failover.maxAttemptsPerProvider, 2)
  assert.equal(f.config.mainStreamingMode, 'off')
  assert.equal(f.calls.length, 2)
  assert.deepEqual(f.calls[0], f.calls[1])
  assert.equal(f.cooldown.size, 0)
  for (const enabled of [undefined, false, true]) {
    const config = mobileModelConfig({ endpoint: 'https://example.com/v1', model: 'm', modelOptions: { failoverEnabled: enabled } })
    assert.equal(config.failover!.enabled, visionProjection({ providers: config.providers as any, modelOptions: { failoverEnabled: enabled } }).failoverEnabled)
  }
})

for (const status of [400, 401, 402, 403, 422]) test(`P0 HTTP ${status} skips attempts and cooldown, retaining configured fallback`, async () => {
  const f = fixture(body => { if (body.model === 'first') throw httpError(status); return response() })
  await f.narrator.decide(request()); await f.narrator.decide(request())
  assert.deepEqual(f.calls.map(call => call.body.model), ['first', 'second', 'first', 'second'])
  assert.equal(f.cooldown.size, 0)
})

test('P0 deterministic rejection with failover disabled never calls another connection', async () => {
  const f = fixture(() => { throw httpError(401) }, { failoverEnabled: false })
  await assert.rejects(f.narrator.decide(request()), /All narrative providers failed/)
  assert.equal(f.calls.length, 1); assert.equal(f.cooldown.size, 0)
})

test('P0 429 honors Retry-After before retrying the same provider', async () => {
  const times: number[] = []
  const f = fixture((_body, call) => { times.push(Date.now()); if (call === 1) throw httpError(429, { 'Retry-After': '0.03' }); return response() })
  await f.narrator.decide(request())
  assert.equal(f.calls.length, 2)
  assert.ok(times[1] - times[0] >= 29)
  assert.equal(f.cooldown.size, 0)
})

test('P0 429 backoff supports HTTP-date, jitter and 10 second cap; timeout/network have no delay', async t => {
  const delays: number[] = []
  const now = Date.parse('2026-10-21T00:00:00Z')
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => { delays.push(delay); queueMicrotask(callback); return 0 })
  t.mock.method(Math, 'random', () => 0.5)
  const filter = mobileRetryFilter(2), detail = { task: '主叙事', attempt: 1, providerId: 'first' }
  for (const headers of [{ 'retry-after': '60' }, new Headers({ 'Retry-After': new Date(now + 4000).toUTCString() }), {}, { 'Retry-After': 'invalid' }]) assert.equal(await filter(httpError(429, headers), detail), 'retry')
  for (const message of ['timeout', 'network ECONNRESET']) assert.equal(await filter(new Error(message), detail), 'retry')
  await filter(httpError(429), { ...detail, attempt: 2 })
  assert.deepEqual(delays, [10000, 4000, 2250, 2250])
  assert.equal(await filter(Object.assign(httpError(429), { response: { status: 429, data: { error: { code: 'insufficient_quota' } } } }), detail), 'next')
})

test('P0 budget exhausted at attempt 2 aborts all providers without cooldown pollution', async () => {
  const budget = Object.assign(new Error('预算耗尽'), { code: 'HDS_MOBILE_BUDGET' })
  const f = fixture(() => { throw new Error('timeout') })
  let reservations = 0
  f.config.mobileBeforeRequest = () => { if (++reservations === 2) throw budget }
  await assert.rejects(f.narrator.decide(request()), error => error === budget)
  assert.equal(reservations, 2); assert.equal(f.calls.length, 1); assert.equal(f.cooldown.size, 0)
})

for (const error of [Object.assign(new Error('预算耗尽'), { code: 'HDS_MOBILE_BUDGET' }), new Error('context disposed'), new Error('cannot create effect on inactive context')]) {
  test(`P0 uncapped retry rethrows ${error.message} without further attempts or cooldown`, async () => {
    const f = fixture((_body, call) => { if (call === 1) return response('incomplete JSON'); throw error })
    await assert.rejects(f.narrator.decide(request()), failure => failure === error)
    assert.equal(f.calls.length, 2)
    assert.ok(!('max_tokens' in f.calls[1].body)); assert.equal(f.cooldown.size, 0)
  })
}

test('P0 early reply committed during uncapped retry prevents another generation or failover', async () => {
  const f = fixture(() => response())
  let generations = 0, visible = 0
  const attempts: number[] = []
  ;(f.narrator as any).requestProvider = async (_provider: unknown, input: NarrativeRequest, _overrides: unknown, _usages: unknown, _task: string, attempt: number) => {
    attempts.push(attempt)
    if (++generations === 1) throw new Error('invalid JSON')
    await input.onEarlyReply!({ content: '已送达' } as any)
    throw new Error('stream failed')
  }
  await assert.rejects(f.narrator.decide({ ...request(), onEarlyReply: async () => { visible++; return true } }), /stream failed/)
  assert.equal(generations, 2); assert.equal(visible, 1); assert.equal(f.cooldown.size, 0)
  assert.deepEqual(attempts, [1, 1])
})

test('P0 committed early reply is classified as abort by the runtime filter', async () => {
  const f = fixture(() => response())
  const original = f.config.mobileRetryFilter!
  const actions: unknown[] = []
  f.config.mobileRetryFilter = async (error, detail) => { const action = await original(error, detail); actions.push(action); return action }
  ;(f.narrator as any).requestProvider = async (_provider: unknown, input: NarrativeRequest) => {
    await input.onEarlyReply!({ content: '已送达' } as any); throw new Error('network')
  }
  await assert.rejects(f.narrator.decide({ ...request(), onEarlyReply: async () => true }), /after an early visible reply/)
  assert.deepEqual(actions, ['abort']); assert.equal(f.cooldown.size, 0)
})

for (const uncapped of [false, true]) test(`P0 turn deadline aborts before ${uncapped ? 'uncapped retry' : 'attempt 2'}`, async t => {
  let now = 1000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(() => { now += 240001; if (uncapped) return response('incomplete JSON'); throw new Error('timeout') })
  await assert.rejects(f.narrator.decide(request()), (error: any) => error.code === 'HDS_MOBILE_TURN_DEADLINE')
  assert.equal(f.calls.length, 1); assert.equal(f.cooldown.size, 0)
})

test('P0 explicit abort hook terminates the whole turn without cooldown', async () => {
  const f = fixture(() => { throw new Error('custom stop') })
  f.config.mobileRetryFilter = () => 'abort'
  await assert.rejects(f.narrator.decide(request()), /custom stop/)
  assert.equal(f.calls.length, 1); assert.equal(f.cooldown.size, 0)
})

test('P0 final uncapped error controls deterministic cooldown exemption', async () => {
  const f = fixture((body, call) => { if (body.model === 'second') return response(); if (call === 1) return response('incomplete JSON'); throw httpError(401) })
  await f.narrator.decide(request())
  assert.deepEqual(f.calls.map(call => call.body.model), ['first', 'first', 'second'])
  assert.equal(f.cooldown.size, 0)
})

test('P0 user-initiated due retry preserves foreground budget exemption; background remains charged', async () => {
  const f = fixture(() => response())
  const foreground: boolean[] = []
  f.config.mobileBeforeRequest = value => { foreground.push(!!value); if (!value) throw Object.assign(new Error('预算'), { code: 'HDS_MOBILE_BUDGET' }) }
  await f.narrator.decide({ ...request(), phase: 'intent-due', mobileForeground: true })
  await assert.rejects(f.narrator.decide({ ...request(), phase: 'intent-due' }), /预算/)
  assert.deepEqual(foreground, [true, false]); assert.equal(f.calls.length, 1); assert.equal(f.cooldown.size, 0)
})

test('P0 unset hook retains legacy retries, cooldown and byte-for-byte transport', async () => {
  const f = fixture((_body, call) => { if (call <= 2) throw httpError(401); return response() })
  delete f.config.mobileRetryFilter; delete f.config.mobileTurnDeadlineMs
  await f.narrator.decide(request())
  assert.deepEqual(f.calls.map(call => call.body.model), ['first', 'first', 'second'])
  assert.deepEqual([...f.cooldown.keys()], ['first'])
  // Captured from the pre-P0 narrator with this exact fixture/configuration.
  assert.equal(createHash('sha256').update(JSON.stringify(f.calls)).digest('hex'), '62391327a234b69b2fab3f7d7d534461b81d8422bd18edc6f53b372227a44bfb')
})

test('P0 built host contains retry hook, attempt diagnostics and guarded fallback', () => {
  const built = readFileSync('runtime/generated/host.cjs', 'utf8')
  for (const marker of ['mobileRetryFilter', 'HDS_MOBILE_TURN_DEADLINE', 'mobileModelEventCount', 'mobileModelEventStart', 'mobileForeground']) assert.ok(built.includes(marker), marker)
  assert.match(built, /diagnosticCall\("model"[\s\S]{0,350}attempt/)
})
