import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { OpenAICompatibleEmbedder, classifyRetrievalError } from '../upstream/hds-interlude/src/narrator'
import { deriveRetrievalEndpoint, resolveEffectiveEmbeddingTarget } from '../upstream/hds-interlude/src/model-routing'
const require = createRequire(import.meta.url)
const { Context } = require('koishi'), { HTTP } = require('@cordisjs/plugin-http')
export const embeddingConfig = (endpoint = 'https://example.invalid/v1') => ({ providers: [{ id: 'embed', enabled: true, label: 'fixture', endpoint, model: 'chat', apiKey: 'mock-secret', useForEmbedding: true }], embedding: { enabled: true, providerId: '', endpoint: '', model: 'vector', dimensions: 0, timeout: 500, maxInputCharacters: 4000 } }) as any

test('safe endpoint pathname derivation retains query, prefix and version; custom and credential URLs rejected', () => {
  for (const [path, expected] of [['/', '/v1/embeddings'], ['/v2/', '/v2/embeddings'], ['/prefix/v1', '/prefix/v1/embeddings'], ['/prefix/chat/completions/', '/prefix/embeddings'], ['/v1/embeddings', '/v1/embeddings']]) assert.equal(deriveRetrievalEndpoint(`https://example.invalid${path}?test=1`, 'embedding'), `https://example.invalid${expected}?test=1`)
  for (const value of ['https://example.invalid/custom', 'https://user@example.invalid/v1', 'https://example.invalid/v1#x', 'file:///v1', 'https://@example.invalid/v1', 'https://example.invalid/v1#']) assert.throws(() => deriveRetrievalEndpoint(value, 'embedding'), /endpoint_required/)
  const config = embeddingConfig(); config.embedding.endpoint = 'https://other.invalid/embeddings'
  assert.equal(resolveEffectiveEmbeddingTarget(config).reason, 'endpoint_origin')
  config.embedding.endpoint = ''; config.providers[0].useForEmbedding = false
  assert.equal(resolveEffectiveEmbeddingTarget(config).reason, 'provider_required')
})

test('real Koishi HTTP embedding uses explicit model, excludes chat fields, refuses redirects and invalid vectors', async () => {
  const requests: any[] = []; let status = 200; let vector: unknown = [1, 2]; let redirect = false
  const server = createServer(async (req, res) => { let data = ''; for await (const chunk of req) data += chunk; requests.push({ url: req.url, body: JSON.parse(data), auth: req.headers.authorization }); res.writeHead(redirect ? 307 : status, { 'content-type': 'application/json', ...(redirect ? { location: '/destination' } : {}) }); res.end(JSON.stringify({ data: [{ embedding: vector }] })) })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const ctx = new Context(); ctx.plugin(HTTP); await ctx.start()
  const config = embeddingConfig(`http://127.0.0.1:${(server.address() as any).port}/v1`)
  const client = new OpenAICompatibleEmbedder(ctx, config)
  try {
    assert.deepEqual(await client.embed('neutral', { foreground: true }), [1, 2])
    assert.deepEqual(requests[0], { url: '/v1/embeddings', body: { model: 'vector', input: 'neutral' }, auth: 'Bearer mock-secret' })
    const id = client.identity(); config.embedding.model = 'different'; assert.notEqual(client.identity(), id)
    for (vector of [[], [0, 0], ['1'], [null]]) await assert.rejects(client.embed('neutral'), /invalid_response/)
    vector = [1]; redirect = true
    const before = requests.length; await assert.rejects(client.embed('neutral')); assert.equal(requests.length, before + 1)
    redirect = false; status = 401; await assert.rejects(client.embed('neutral'), /authentication/)
    config.mobileBeforeRequest = () => { throw new Error('后台预算') }; const count = requests.length; await assert.rejects(client.embed('neutral'), /background_budget/); assert.equal(requests.length, count)
  } finally { await ctx.stop(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
})
test('gateway categories require response evidence and remain secret free', () => {
  for (const [status, body, category] of [[500, 'convert_request_failed', 'gateway_convert_request'], [500, 'model ratio not found', 'gateway_model_ratio'], [500, 'other', 'provider_error'], [404, 'other', 'route_not_found'], [405, 'other', 'route_not_found'], [422, 'other', 'invalid_request']]) assert.equal(classifyRetrievalError({ response: { status, data: body } }).category, category)
})
