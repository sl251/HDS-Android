import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, copyFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerTables } from '../upstream/hds-interlude/src/database'
import { InterludeService } from '../upstream/hds-interlude/src/service'
const require = createRequire(import.meta.url), { Context } = require('koishi'), { SQLiteDriver } = require('@minatojs/driver-sqlite')
test('WASM backup upgrade preserves old fact/sticker/zero observation IDs and adds nullable identities', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hds-952-index-')), original = join(dir, 'old.sqlite'), backup = join(dir, 'backup.sqlite')
  const schema = new Context(); registerTables(schema, true)
  const legacy = new Context(); legacy.plugin(SQLiteDriver, { path: original })
  for (const name of ['interlude_fact', 'interlude_sticker', 'interlude_web_observation']) {
    const table = schema.model.tables[name]
    const fields = { ...table.fields }; delete fields.embeddingIdentity
    legacy.model.extend(name, fields, { primary: table.primary, autoInc: true })
  }
  await legacy.start()
  const now = new Date()
  await legacy.database.create('interlude_fact', { id: 7, storyId: 's', participantId: '', scope: 'world', content: '保留事实', importance: 1, confidence: 1, unresolved: false, embedding: [1, 0], status: 'active', sourceEntryIds: [1], createdAt: now, updatedAt: now, lastSeenAt: now })
  await legacy.database.create('interlude_sticker', { id: 8, assetId: 'fixture', description: '保留素材', embedding: [0, 1], status: 'active', createdAt: now, updatedAt: now })
  await legacy.database.create('interlude_web_observation', { id: 0, storyId: 's', participantId: 'alice', status: 'success', mode: 'visit', accessedAt: now, createdAt: now })
  await legacy.stop(); copyFileSync(original, backup)
  const before = readFileSync(original)
  const upgraded = new Context(); upgraded.plugin(SQLiteDriver, { path: backup }); registerTables(upgraded, true); await upgraded.start()
  try {
    const [fact] = await upgraded.database.get('interlude_fact', { id: 7 }), [sticker] = await upgraded.database.get('interlude_sticker', { id: 8 })
    assert.equal(fact.content, '保留事实'); assert.deepEqual(fact.embedding, [1, 0]); assert.ok(!fact.embeddingIdentity)
    assert.equal(sticker.description, '保留素材'); assert.ok(!sticker.embeddingIdentity)
    const host: any = Object.assign(Object.create(InterludeService.prototype), { config: { browser: { maxExcerptCharacters: 3000 } }, dbCreate: (table: string, data: any) => upgraded.database.create(table, data), appendEntry: async () => {} })
    const ids = [0]
    for (const status of ['success', 'failed', 'blocked']) ids.push((await host.saveWebObservation('s', 'alice', null, 'visit', '', 'https://example.invalid', '', '', '', status, now)).id)
    assert.equal(new Set(ids).size, 4)
    assert.deepEqual(readFileSync(original), before, 'migration only touched backup')
  } finally { await upgraded.stop() }
})
test('index write binds request identity; changing same-dimension model drops late vectors', async () => {
  let identity = 'old'; let resolve: (value: number[]) => void = () => {}
  const host: any = Object.assign(Object.create(InterludeService.prototype), { config: { model: { mobileEmbeddingIdentity: true, embedding: { enabled: true } } }, embedder: { identity: () => identity, embed: () => new Promise(r => { resolve = r }) } })
  const pending = host.embedIndexedText('neutral'); identity = 'new'; resolve([1, 0]); assert.deepEqual(await pending, { vector: [] })
})
test('sticker catalog with incomplete identity returns complete catalog', async () => {
  const assets = Array.from({ length: 15 }, (_, id) => ({ id, embedding: [1, 0], embeddingIdentity: id === 0 ? 'current' : undefined }))
  const host: any = Object.assign(Object.create(InterludeService.prototype), { stickerCatalog: assets, embedder: { identity: () => 'current' }, config: { model: { mobileEmbeddingIdentity: true, embedding: { semanticStickerFilter: true } }, stickers: { catalogLimit: 100 } } })
  assert.equal((await host.rankStickerAssets([1, 0])).length, 15)
})

test('mobile table registration upgrades an existing parent registry once without rebuilding other fields', () => {
  const ctx = new Context(); registerTables(ctx)
  assert.equal('embeddingIdentity' in ctx.model.tables.interlude_fact.fields, false)
  registerTables(ctx, true)
  for (const name of ['interlude_fact', 'interlude_sticker']) assert.ok(ctx.model.tables[name].fields.embeddingIdentity)
  const field = ctx.model.tables.interlude_fact.fields.embeddingIdentity
  registerTables(ctx, true); assert.equal(ctx.model.tables.interlude_fact.fields.embeddingIdentity, field)
})

test('same-dimension model identities never mix in fact cosine ranking, and invalid dimensions fall back locally', async () => {
  const now = new Date(), base = { storyId: 's', status: 'active', scope: 'world', content: 'neutral', importance: 0, confidence: 0, lastSeenAt: now, updatedAt: now, createdAt: now }
  const rows = [{ ...base, id: 1, embedding: [0.6, 0.8], embeddingIdentity: 'new' }, { ...base, id: 2, embedding: [1, 0], embeddingIdentity: 'old' }, { ...base, id: 3, embedding: [100], embeddingIdentity: 'new' }]
  let identity = 'new'
  const host: any = Object.assign(Object.create(InterludeService.prototype), { config: { model: { mobileEmbeddingIdentity: true, embedding: { liveQuery: false }, rerank: { enabled: false } } }, embedder: { identity: () => identity }, dbGet: async (_t: string, query: any) => query.scope ? [] : rows })
  Object.defineProperty(host, 'memoryConfig', { value: { maxFactsPerStory: 200, factImportanceWeight: 0, factConfidenceWeight: 0, factRecencyWeight: 0, semanticWeight: 1, unresolvedWeight: 0 } })
  assert.equal((await host.facts('s', 3, '', undefined, [1, 0]))[0].id, 1)
  identity = 'old'; assert.equal((await host.facts('s', 3, '', undefined, [1, 0]))[0].id, 2)
})
