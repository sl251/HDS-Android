import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseJsonCard } from '../packages/card-format'
import type { ModelProvider } from '../packages/contracts'
import { embeddingProviders, mobileSchema, normalizeMobileConfig, mapMobileConfig } from '../runtime/mobile-config'
import { mobilePreset } from '../runtime/preset'
import { assignTask, assigned, removeProvider } from '../apps/mobile-ui/model-tasks'
import { resolveModelRouting } from '../upstream/hds-interlude/src/model-routing'
import { OpenAICompatibleEmbedder, type ModelConfig } from '../upstream/hds-interlude/src/narrator'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

const provider = (id: string, embedding = false): ModelProvider => ({ id, preset: 'custom', label: id, model: id, endpoint: 'http://127.0.0.1:1/v1/chat/completions', protocol: 'chat-completions', enabled: true, credentialPresent: false, useForMain: !embedding, useForCompaction: !embedding, useForAlter: !embedding, useForEmbedding: embedding })

test('M2 schema exposes upstream expression defaults, Embedding and actual rc56 weather fields', () => {
  const fields = (key: string) => mobileSchema().sections.find(section => section.key === key)!.fields
  const actions = Object.fromEntries(fields('chatActions').map(field => [field.key, field.default]))
  assert.deepEqual(actions, { enabled: false, quoteReply: true, messageReactions: true, nativeFaces: true, allowedReactions: ['like', 'smile', 'laugh', 'heart'], allowedNativeFaces: ['smile', 'laugh', 'sweat', 'awkward'], expressionThreshold: .7 })
  assert.deepEqual(fields('chatActions').find(field => field.key === 'allowedReactions')!.itemOptions, ['like', 'smile', 'laugh', 'heart', 'surprised', 'sad', 'angry'])
  assert.deepEqual(Object.fromEntries(fields('embedding').map(field => [field.key, field.default])), { enabled: false, liveQuery: false, providerId: '' })
  assert.deepEqual(Object.fromEntries(fields('weather').map(field => [field.key, field.default])), { enabled: false, latitude: 39.14, longitude: 117.18, autoFromLocation: true, skipFantasyWorld: false, cadenceMinutes: 30 })
  const sections = { chatActions: { enabled: true, messageReactions: true, nativeFaces: true, allowedReactions: ['heart'], allowedNativeFaces: ['sweat'] }, embedding: { enabled: true, liveQuery: false, providerId: 'vector' }, weather: { enabled: true, latitude: -20, longitude: 120, cadenceMinutes: 5 } }
  assert.deepEqual(normalizeMobileConfig({ sections }).sections, sections)
  for (const autoAdvance of [false, true]) {
    const mapped = mapMobileConfig({ sections }, autoAdvance)
    assert.deepEqual(mapped.chatActions, sections.chatActions)
    assert.deepEqual(mapped.model.embedding, sections.embedding)
    assert.deepEqual(mapped.weather, { enabled: false, latitude: 39.14, longitude: 117.18, autoFromLocation: true, skipFantasyWorld: false, cadenceMinutes: 30, ...sections.weather })
    assert.equal(mapped.runtime.contextEntryLimit, 20)
    assert.equal(mapped.runtime.contextTimeWindowMinutes, 10)
    assert.equal(mapped.alterSystem.maxTokens, 400)
  }
  for (const sections of [{ chatActions: { allowedReactions: ['bad'] } }, { chatActions: { allowedNativeFaces: [1] } }, { weather: { latitude: 91 } }, { weather: { cadenceMinutes: 4 } }, { embedding: { endpoint: 'http://bad' } }, { embedding: { providerId: 123 } }]) assert.throws(() => normalizeMobileConfig({ sections }))
  const synced = mobilePreset({ weather: sections.weather, chatActions: sections.chatActions }, {})
  assert.deepEqual(synced.config.sections.weather, sections.weather)
  assert.deepEqual(synced.config.sections.chatActions, sections.chatActions)
})

test('M2 vector assignment stays independent, respects explicit routing and rejects unusable routes', () => {
  let providers = [provider('writer'), { ...provider('vector', true), useForEmbedding: false }, provider('next')]
  providers = assignTask(providers, 'useForEmbedding', 'vector')
  providers = assignTask(providers, 'useForMain', 'next')
  assert.deepEqual(assigned(providers, 'useForEmbedding'), ['vector'])
  assert.deepEqual(assigned(removeProvider(providers, 'vector'), 'useForEmbedding'), [])
  assert.deepEqual(assigned(assignTask(providers, 'useForEmbedding', ''), 'useForEmbedding'), [])
  assert.deepEqual(assigned(embeddingProviders(providers, { enabled: true, providerId: 'writer' }), 'useForEmbedding'), ['writer'])
  for (const rows of [[provider('writer')], [{ ...provider('vector', true), enabled: false }], [{ ...provider('vector', true), protocol: 'anthropic-messages' as const }]]) assert.throws(() => embeddingProviders(rows, { enabled: true }), /向量连接/)
  assert.throws(() => embeddingProviders(providers, { enabled: true, providerId: 'missing' }))
  assert.doesNotThrow(() => embeddingProviders([provider('writer')], { enabled: false }))
})

test('M2 real host serves QQ sticker URLs on the RPC port and bridges Embedding to /embeddings', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-m2-'))
  const reserve = createServer()
  await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve))
  const port = (reserve.address() as { port: number }).port
  await new Promise<void>(resolve => reserve.close(() => resolve()))
  const requests: { url: string; body: any; authorization?: string }[] = []
  const api = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    requests.push({ url: request.url!, body: JSON.parse(body), authorization: request.headers.authorization })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ data: [{ embedding: [.3, .4] }] }))
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const endpoint = `http://127.0.0.1:${(api.address() as { port: number }).port}/v1/chat/completions`
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost({ card: parseJsonCard(JSON.stringify({ name: '星禾', description: '朋友' })), endpoint, model: 'writer', token: 'm2-integration-token-at-least-32-characters', port, dataDir, userName: '我', userProfile: '', autoAdvance: false,
      providers: [provider('writer'), { ...provider('vector', true), endpoint, apiKey: 'fixture-vector-key' }],
      mobileConfig: { sections: { chatActions: { enabled: true }, embedding: { enabled: true, providerId: 'vector' } } } })
    const service = host.app.interlude as any
    assert.ok(host.app.server, 'The actual server service must be installed')
    assert.equal(host.app.server._http.listening, false, 'Only the existing RPC listener owns the port')
    assert.equal(service.config.stickers.deliveryBaseUrl, `http://127.0.0.1:${port}`)
    const status = await host.dispatch('config.status', {}) as any
    assert.equal(status.sections.embedding.enabled, true)
    assert.equal(status.sections.embedding.liveQuery, false)
    assert.equal(status.sections.embedding.providerId, 'vector')
    assert.equal(service.config.chatActions.messageReactions, true)
    assert.equal(service.config.chatActions.nativeFaces, true)
    const routing = resolveModelRouting(service.config.model)
    assert.equal(routing.embedding.providers[0].model, 'vector')
    const embedder = new OpenAICompatibleEmbedder(host.app, service.config.model as ModelConfig)
    assert.deepEqual(await embedder.embed('一条长期记忆'), [.3, .4])
    assert.deepEqual(requests, [{ url: '/v1/embeddings', body: { model: 'vector', input: '一条长期记忆' }, authorization: 'Bearer fixture-vector-key' }])
    assert.equal(service.config.model.embedding.endpoint, '')
    assert.equal(service.config.model.embedding.dimensions, 0)
    assert.equal(service.config.model.embedding.timeout, 10000)
    assert.equal(service.config.model.embedding.maxInputCharacters, 4000)

    // Seed a scanned asset, then exercise the actual upstream sendSticker path.
    // The fake OneBot sender acts like NapCat: fetch the supplied URL itself.
    const directory = join(dataDir, 'stickers', 'default'); mkdirSync(directory, { recursive: true })
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
    writeFileSync(join(directory, 'ok.png'), png)
    writeFileSync(join(dataDir, 'outside.png'), png)
    symlinkSync(join(dataDir, 'outside.png'), join(directory, 'escape.png'))
    const asset = { assetId: 'm2-active', status: 'active', filePath: 'default/ok.png', mimeType: 'image/png', description: '开心', group: 'default', animated: false }
    for (const row of [asset, { ...asset, assetId: 'pending', status: 'pending' }, { ...asset, assetId: 'missing', filePath: 'default/gone.png' }, { ...asset, assetId: 'escape', filePath: 'default/escape.png' }, { ...asset, assetId: 'traversal', filePath: '../outside.png' }]) service.stickerById.set(row.assetId, row)
    const base = `http://127.0.0.1:${port}`
    let delivered = ''
    const bot = { sendMessage: async (channelId: string, content: unknown) => {
      assert.equal(channelId, '12345')
      delivered = String(content)
      const url = /src="([^"]+)"/.exec(delivered)![1]
      assert.equal(url, `${base}/hds-interlude/sticker/m2-active`)
      const response = await fetch(url)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type')!, /image\/png/)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
      return ['qq-delivery-id']
    } }
    const story = (await host.dispatch('story.snapshot', {}) as any).story
    assert.equal(await service.sendSticker(story, { bot, platform: 'onebot', selfId: 'bot' }, '12345', asset, '12345'), true)
    assert.match(delivered, /http:/)
    for (const id of ['unknown', 'pending', 'missing', 'escape', 'traversal']) assert.equal((await fetch(`${base}/hds-interlude/sticker/${id}`)).status, 404, id)
    assert.equal((await fetch(`${base}/rpc`, { method: 'POST', body: '{"method":"health"}' })).status, 401)
    assert.equal((await fetch(`${base}/hds-interlude/sticker/m2-active`, { method: 'POST' })).status, 401)
    const health = await fetch(`${base}/rpc`, { method: 'POST', headers: { Authorization: 'Bearer m2-integration-token-at-least-32-characters' }, body: '{"method":"health"}' })
    assert.equal(health.status, 200)
    assert.equal((await health.json() as any).data.platform, 'mobile-local')
  } finally {
    await host?.stop()
    await new Promise<void>(resolve => api.close(() => resolve()))
    rmSync(dataDir, { recursive: true, force: true })
  }
})
