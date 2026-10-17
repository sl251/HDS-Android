import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseJsonCard } from '../packages/card-format'

const { mobilePreset, inspectPreset, startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

test('share persona survives mobile preview, including persona-only shares and partial nonempty fields', async () => {
  const current = { backgroundLimit: 42, sections: { agency: { enabled: false } } }
  const payload = { storyDefaults: { characterName: '星禾', world: '海边小镇', relationship: '老朋友', perspective: '乐观', characterProfile: ' ', userProfile: '', perspectives: ['珍惜日常', ''] }, agency: { enabled: true } }
  const expected = { character: { name: '星禾' }, world: '海边小镇', relationship: '老朋友', perspective: '乐观', perspectives: ['珍惜日常'] }
  const preview = mobilePreset(payload, current)
  assert.deepEqual(preview.storyPatch, expected)
  assert.ok(!preview.removed.includes('storyDefaults'))
  assert.equal(preview.config.sections.agency.enabled, true)
  assert.equal(current.sections.agency.enabled, false)
  const personaOnly = mobilePreset({ storyDefaults: payload.storyDefaults }, current)
  assert.deepEqual(personaOnly.storyPatch, expected)
  assert.deepEqual(personaOnly.config, mobilePreset({ agency: { enabled: false } }, current).config)
  assert.equal(mobilePreset({ agency: { enabled: true } }, current).storyPatch, undefined)
  let revision = 1
  const ctx = { http: { get: async () => ({ code: 'ABCDEFGH', revision, sections: Object.keys(payload), payload }) } }
  const inspected = await inspectPreset(ctx as never, 'ABCDEFGH', current)
  assert.deepEqual(inspected.storyPatch, expected)
  assert.ok(!inspected.removed.includes('storyDefaults'))
  await inspectPreset(ctx as never, 'ABCDEFGH', current, inspected.fingerprint)
  payload.storyDefaults.world = '变更后的世界'
  await assert.rejects(() => inspectPreset(ctx as never, 'ABCDEFGH', current, inspected.fingerprint), /版本已变化/)
  revision++
  await assert.rejects(() => inspectPreset(ctx as never, 'ABCDEFGH', current, inspected.fingerprint), /版本已变化/)
})

test('story.applySetting persists share persona to the current story and preserves unspecified setting and history', { timeout: 60000 }, async () => {
  const reserve = createServer()
  await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve))
  const port = (reserve.address() as { port: number }).port
  await new Promise<void>(resolve => reserve.close(() => resolve()))
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-share-persona-'))
  const config = { card: parseJsonCard(JSON.stringify({ name: '原角色', description: '原人设', scenario: '原世界', first_mes: '原开场白' })), endpoint: 'http://127.0.0.1:1/v1/chat/completions', model: 'fixture', userName: '我', userProfile: '原用户人设', autoAdvance: false, token: 'share-persona-test-token-more-than-32-characters', port, dataDir }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const snapshot = async () => (await host!.dispatch('story.snapshot', {}) as any).story
    const before = await snapshot()
    const history = await host.dispatch('messages.history', {})
    const payload = { storyDefaults: { characterName: '星禾', world: '海边', relationship: '老朋友', perspective: '乐观' } }
    host.app.http.get = (async () => ({ code: 'ABCDEFGH', revision: 1, sections: ['storyDefaults'], payload })) as typeof host.app.http.get
    const preview = await host.dispatch('preset.sync', { code: 'ABCDEFGH', current: {} }) as ReturnType<typeof mobilePreset> & { fingerprint: string }
    assert.deepEqual((await snapshot()).setting, before.setting, 'Preview must not write persona')
    const checked = await host.dispatch('preset.sync', { code: 'ABCDEFGH', current: {}, fingerprint: preview.fingerprint }) as ReturnType<typeof mobilePreset>
    assert.deepEqual((await snapshot()).setting, before.setting, 'Life sync alone must not write persona')
    await host.dispatch('story.applySetting', checked.storyPatch!)
    const after = await snapshot()
    assert.equal(after.id, before.id)
    assert.deepEqual(after.setting.character, { ...before.setting.character, name: '星禾' })
    assert.deepEqual(after.setting.user, before.setting.user)
    for (const field of ['world', 'relationship', 'perspective'] as const) assert.equal(after.setting[field], checked.storyPatch![field])
    assert.deepEqual(await host.dispatch('messages.history', {}), history)
    await host.dispatch('story.applySetting', { relationship: '新的关系' })
    assert.equal((await snapshot()).setting.world, '海边', 'Successive partial patches retain previously imported fields')
    await host.stop(); host = await startHost(config)
    assert.equal((await snapshot()).setting.character.name, '星禾')
    assert.equal((await snapshot()).setting.relationship, '新的关系')
    assert.deepEqual(await host.dispatch('messages.history', {}), history)
  } finally { await host?.stop(); rmSync(dataDir, { recursive: true, force: true }) }
})
