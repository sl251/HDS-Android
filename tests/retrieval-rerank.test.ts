import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { RerankClient } from '../upstream/hds-interlude/src/narrator'
const require = createRequire(import.meta.url), { Context } = require('koishi'), { HTTP } = require('@cordisjs/plugin-http')
test('real rerank protocol strictly validates, stably sorts, never retries or follows redirect, and cancels timeout', async () => {
  const requests: any[] = []; let status = 200; let delay = 0; let results: any = [{ index: 1, relevance_score: 0.5 }, { index: 0, relevance_score: 0.5 }]
  const server = createServer(async (req, res) => { let data = ''; for await (const chunk of req) data += chunk; requests.push({ url: req.url, body: JSON.parse(data) }); if (delay) await new Promise(r => setTimeout(r, delay)); res.writeHead(status, { 'content-type': 'application/json', location: '/redirect' }); res.end(JSON.stringify({ results })) })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const ctx = new Context(); ctx.plugin(HTTP); await ctx.start()
  const config: any = { providers: [{ id: 'rr', enabled: true, model: 'chat', endpoint: `http://127.0.0.1:${(server.address() as any).port}/v1`, apiKey: 'mock-secret' }], rerank: { enabled: true, providerId: 'rr', endpoint: '', model: 'ranker', topN: 20, scoreThreshold: 0, timeout: 500 } }
  const client = new RerankClient(ctx, config)
  try {
    assert.deepEqual(await client.rerank('query', ['first', 'second'], 2), [{ index: 0, relevanceScore: 0.5 }, { index: 1, relevanceScore: 0.5 }])
    assert.deepEqual(requests[0], { url: '/v1/rerank', body: { model: 'ranker', query: 'query', documents: ['first', 'second'], top_n: 2, return_documents: false } })
    for (results of [[], [{ index: 0, relevance_score: 1 }, { index: 0, relevance_score: 0 }], [{ index: 2, relevance_score: 1 }], [{ index: 0, relevance_score: '1' }], [{ index: 0.5, relevance_score: 1 }]]) await assert.rejects(client.rerank('query', ['first', 'second'], 2), /invalid_response/)
    results = [{ index: 1, relevance_score: 4 }]; assert.equal((await client.rerank('query', ['first', 'second'], 2)).length, 1)
    for (status of [302, 307, 401, 404, 405, 500]) { const before = requests.length; await assert.rejects(client.rerank('query', ['first', 'second'], 2)); assert.equal(requests.length, before + 1) }
    status = 200; delay = 1500; const started = Date.now(); await assert.rejects(client.rerank('query', ['first', 'second'], 2), /timeout/); assert.ok(Date.now() - started < 1200)
    config.rerank.enabled = false; const before = requests.length; assert.deepEqual(await client.rerank('query', ['first', 'second'], 2), []); assert.equal(requests.length, before)
  } finally { await ctx.stop(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
})
