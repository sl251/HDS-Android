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
