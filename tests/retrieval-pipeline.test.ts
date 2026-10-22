import test from 'node:test'
import assert from 'node:assert/strict'
import { InterludeService } from '../upstream/hds-interlude/src/service'
const now = new Date()
const facts = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, storyId: 's', status: 'active', content: `neutral fact ${i}`, importance: 1 - i / 10, confidence: 1, scope: i === 0 ? 'event' : i === 1 ? 'promise' : 'world', unresolved: i === 1, updatedAt: now, lastSeenAt: now, createdAt: now }))
function fixture() {
  let calls = 0; let fail = false; let score = 0.9
  const host: any = Object.assign(Object.create(InterludeService.prototype), { config: { runtime: { maxStoriesPerSweep: 20 }, memory: { enabled: true }, model: { embedding: { enabled: false }, rerank: { enabled: false, topN: 20, scoreThreshold: 0 } } }, embedder: { embed: () => assert.fail('No implicit query embedding') },
    dbGet: async (_table: string, query: any) => facts.filter(f => !query.scope || f.scope === query.scope),
    reranker: { rerank: async (_query: string, docs: string[], topN: number) => { calls++; if (fail) throw new Error('mock failure'); assert.ok(docs.length <= 30); return Array.from({ length: topN }, (_, i) => ({ index: docs.length - i - 1, relevanceScore: score })) } } })
  return { host, calls: () => calls, fail: () => { fail = true }, low: () => { score = 0.1 } }
}
const ids = (rows: any[]) => rows.map(row => row.id)
test('pipeline protects lanes, uses rerank order and caches once per turn; management reads stay local', async () => {
  const f = fixture(), context = { externalRerank: true, foreground: true, rerankCache: new Map() }
  const baseline = ids(await f.host.facts('s', 4, 'neutral', undefined, [], context)); assert.equal(f.calls(), 0)
  f.host.config.model.rerank.enabled = true
  assert.deepEqual(ids(await f.host.facts('s', 4, 'neutral')), baseline); assert.equal(f.calls(), 0)
  const reranked = ids(await f.host.facts('s', 4, 'neutral', undefined, [], context))
  assert.deepEqual(reranked, [1, 2, 7, 6]); assert.notDeepEqual(reranked, baseline)
  assert.deepEqual(ids(await f.host.facts('s', 4, 'neutral', undefined, [], context)), reranked); assert.equal(f.calls(), 1)
  assert.equal((await f.host.facts('s', 1, 'neutral', undefined, [], context)).length, 1); assert.equal(f.calls(), 1)
})
test('any rerank failure returns entire unchanged baseline; threshold empty retains only protected', async () => {
  const f = fixture(); const baseline = ids(await f.host.facts('s', 4, 'neutral'))
  f.host.config.model.rerank.enabled = true; f.fail()
  assert.deepEqual(ids(await f.host.facts('s', 4, 'neutral', undefined, [], { externalRerank: true })), baseline)
  const g = fixture(); g.host.config.model.rerank.enabled = true; g.host.config.model.rerank.scoreThreshold = 0.7; g.low()
  assert.deepEqual(ids(await g.host.facts('s', 4, 'neutral', undefined, [], { externalRerank: true })), [1, 2])
  await g.host.facts('s', 4, '', undefined, [], { externalRerank: true }); assert.equal(g.calls(), 1)
})

test('actual host keeps chatting with missing embedding route, and failed live embedding still reranks durable facts', { timeout: 45000 }, async () => {
  const { createRequire } = await import('node:module'), { createServer } = await import('node:http'), { mkdtempSync } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path')
  const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs')
  const payloads: any[] = []; let embeddingCalls = 0; let rerankCalls = 0
  const model = createServer(async (req, res) => { let text = ''; for await (const chunk of req) text += chunk; const body = JSON.parse(text); res.setHeader('content-type', 'application/json')
    if (req.url === '/v1/embeddings') { embeddingCalls++; res.statusCode = 401; res.end('{"error":"mock denied"}'); return }
    if (req.url === '/v1/rerank') { rerankCalls++; res.end(JSON.stringify({ results: [{ index: body.documents.length - 1, relevance_score: 1 }] })); return }
    payloads.push(body); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '她收起书，回复消息。', interaction: { seen: true, reply: { mode: 'immediate', content: '收到。' } } }) } }] }))
  }); await new Promise<void>(r => model.listen(0, '127.0.0.1', r))
  const endpoint = `http://127.0.0.1:${(model.address() as any).port}/v1/chat/completions`
  const config: any = { card: { name: 'fixture', description: 'fixture', personality: '', format: 'v2', warnings: [], raw: {} }, endpoint, model: 'chat', userName: '我', userProfile: '', autoAdvance: false, port: 0, token: 'retrieval-fixture-token-longer-than-32', dataDir: mkdtempSync(join(tmpdir(), 'hds-952-pipeline-')), providers: [{ id: 'primary', label: 'fixture', preset: 'custom', endpoint, model: 'chat', enabled: true, protocol: 'chat-completions', useForMain: true, useForCompaction: true, useForAlter: true }], mobileConfig: { sections: { embedding: { enabled: true, liveQuery: true, providerId: 'missing' }, memory: { factLimit: 4 }, alterSystem: { enabled: false } } } }
  let host: any
  const wait = async (condition: () => Promise<boolean>) => { const until = Date.now() + 20000; while (Date.now() < until) { if (await condition()) return; await new Promise(r => setTimeout(r, 50)) }; assert.fail('host retrieval fixture timed out') }
  try {
    host = await startHost(config)
    assert.equal((await host.dispatch('config.status', {})).retrieval.embedding.effective, false)
    await host.dispatch('messages.sendLocal', { requestId: 'retrieval-missing-route', content: '你好' })
    await wait(async () => (await host.dispatch('messages.history', {})).some((m: any) => m.direction === 'character'))
    assert.equal(embeddingCalls, 0); assert.ok(payloads.length >= 1)
    await host.stop(); host = undefined
    config.mobileConfig.sections.embedding = { enabled: true, liveQuery: true, providerId: 'primary', model: 'vector' }
    config.mobileConfig.sections.rerank = { enabled: true, providerId: 'primary', model: 'ranker' }
    host = await startHost(config)
    const story = (await host.dispatch('story.snapshot', {})).story
    for (const fact of facts) await host.app.database.create('interlude_fact', { ...fact, id: undefined, storyId: story.id, participantId: '', sourceEntryIds: [] })
    const before = payloads.length
    await host.dispatch('messages.sendLocal', { requestId: 'retrieval-live-failure', content: 'neutral fact' })
    await wait(async () => (await host.dispatch('diagnostics.messages', { messageId: 'retrieval-live-failure' })).events.some((e: any) => e.stage === 'delivery' && e.outcome === 'delivered'))
    assert.equal(embeddingCalls, 1); assert.equal(rerankCalls, 1); assert.ok(payloads.length > before)
    const events = (await host.dispatch('diagnostics.messages', { messageId: 'retrieval-live-failure' })).events
    assert.ok(events.some((e: any) => e.stage === 'embedding' && e.outcome === 'fallback' && e.reason === 'authentication'))
    assert.ok(events.some((e: any) => e.stage === 'rerank' && e.outcome === 'succeeded'))
    assert.match(JSON.stringify(payloads.at(-1)), /neutral fact 6/)
  } finally { await host?.stop(); model.closeAllConnections(); await new Promise<void>(r => model.close(() => r())) }
})
