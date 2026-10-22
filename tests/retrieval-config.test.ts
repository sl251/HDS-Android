import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMobileConfig, normalizeMobileConfig, mobileSchema } from '../runtime/mobile-config'
import { effectiveRetrievalConfig } from '../runtime/retrieval-config'
import { Config } from '../upstream/hds-interlude/src/index'
import { mobilePreset } from '../runtime/preset'
test('retrieval settings survive actual HDS schema with explicit defaults and optional startup downgrade', () => {
  const mapped = mapMobileConfig({ sections: { embedding: { enabled: true, endpoint: ' https://example.invalid/v1/embeddings ', model: ' vector ', providerId: 'embed', dimensions: 0, timeout: 1000 } } }, false)
  assert.equal(Config({ ...mapped }).model.embedding!.model, 'vector')
  assert.equal(mapped.model.embedding.maxInputCharacters, 4000); assert.equal(mapped.model.embedding.backfillBatchSize, 5)
  assert.equal(mapped.model.embedding.semanticHistory, false); assert.equal(mapped.model.embedding.semanticStickerFilter, true)
  const result = effectiveRetrievalConfig({ ...mapped.model, providers: [] } as any)
  assert.deepEqual(result.status.embedding, { desired: true, effective: false, reason: 'provider_required' })
  assert.equal(mapped.model.embedding.enabled, true)
  assert.equal(mapMobileConfig(undefined, false).alterSystem.maxTokens, 2000)
})
test('native and TS metadata covers string limits and integer validation', () => {
  const fields = mobileSchema().sections.find(s => s.key === 'embedding')!.fields
  assert.equal(fields.find(f => f.key === 'endpoint')!.maxLength, 2048); assert.equal(fields.find(f => f.key === 'model')!.maxLength, 256)
  for (const [key, value] of [['model', 'a'.repeat(257)], ['timeout', 1000.5], ['dimensions', 2.5], ['endpoint', 'https://user@example.invalid/v1'], ['endpoint', 'https://example.invalid/#x'], ['model', true]]) assert.throws(() => normalizeMobileConfig({ sections: { embedding: { [key as string]: value } } }))
  assert.equal(normalizeMobileConfig({ sections: { embedding: { endpoint: 'https://example.invalid/' + 'a'.repeat(150) } } }).sections.embedding.endpoint?.toString().length, 174)
})
test('preset cannot replace local model connections and retrieval routing', () => {
  const current = { sections: { embedding: { providerId: 'local', model: 'vector', endpoint: 'https://example.invalid/v1/embeddings' } } }
  const result = mobilePreset({ urge: { enabled: true }, model: { embedding: { providerId: 'external', endpoint: 'https://evil.invalid', model: 'external' } }, embedding: { providerId: 'external' }, rerank: { endpoint: 'https://evil.invalid' } }, current)
  assert.deepEqual(result.config.sections.embedding, current.sections.embedding)
  assert.doesNotMatch(JSON.stringify(result.config), /external|evil/)
})

test('retrieval diagnostics merge background failures, recover once and reject stale epochs', async () => {
  const { MessageDiagnostics, retrievalDiagnosticRecorder, runMessageDiagnostics } = await import('../runtime/message-diagnostics')
  const { mkdtempSync, readFileSync } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path')
  const file = join(mkdtempSync(join(tmpdir(), 'hds-retrieval-events-')), 'events.json'), store = new MessageDiagnostics(file)
  const record = retrievalDiagnosticRecorder(store, [{ id: 'fixture' }])
  for (let i = 0; i < 3; i++) record({ task: 'embedding', status: 'fallback', providerId: 'fixture', category: 'authentication', httpStatus: 401 })
  assert.equal(store.list().events.length, 1); assert.equal(store.list().events[0].count, 3); assert.deepEqual(store.list().events[0].requestIds, [])
  record({ task: 'embedding', status: 'succeeded', providerId: 'fixture', vectorDimensions: 3 }); assert.equal(store.list().events.length, 2)
  await runMessageDiagnostics(store, ['retrieval-request-first'], async () => { const next = retrievalDiagnosticRecorder(store, [{ id: 'fixture' }]); next({ task: 'rerank', status: 'fallback', providerId: 'fixture', category: 'gateway_model_ratio' }) })
  assert.deepEqual(store.list().events.at(-1)!.requestIds, ['retrieval-request-first'])
  store.clear(); record({ task: 'embedding', status: 'fallback', category: 'network' }); assert.equal(store.list().events.length, 0)
  assert.doesNotMatch(readFileSync(file, 'utf8'), /apiKey|https|fixture/)
})
