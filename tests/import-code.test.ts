import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { inspectImportCode } from '../apps/mobile-ui/preset-preview'
import schema from '../packages/contracts/mobile-config.schema.json'

const { inspectPreset } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

test('import code preview works without a runtime and agrees with host diff and fingerprint', async () => {
  const payload = { storyDefaults: { characterName: '星禾', characterProfile: '修理师', world: '海边' }, agency: { enabled: true, endpoint: 'SECRET', unsupported: true }, model: { apiKey: 'SECRET' } }
  const share = { code: 'ABCDEFGH', revision: 2, title: '分享角色', sections: Object.keys(payload), payload }
  const current = { sections: { agency: { enabled: false } } }
  const before = structuredClone(current)
  const requests: string[] = []
  const next = await inspectImportCode('abcd-efgh', current, async options => {
    requests.push(options.url)
    return { status: 200, data: share, headers: {}, url: options.url }
  })
  const host = await inspectPreset({ http: { get: async () => share } } as never, 'ABCDEFGH', current)
  assert.deepEqual(next, host)
  assert.deepEqual(requests, ['https://typ0.space/api/share/ABCDEFGH'])
  assert.deepEqual(current, before)
  assert.doesNotMatch(JSON.stringify(next), /SECRET|apiKey|https:\/\/secret/)
  assert.equal(next.storyPatch?.character?.name, '星禾')
})

test('preview supports all shipped default fields, no-op and persona-only shares', async () => {
  const defaults = Object.fromEntries(schema.sections.filter(row => row.key !== 'embedding').map(row => [row.key, Object.fromEntries(row.fields.map(field => [field.key, field.default]))]))
  for (const payload of [defaults, { storyDefaults: { characterName: '星禾' } }, { agency: { enabled: false } }]) {
    const share = { code: 'ABCDEFGH', revision: 1, title: 'fixture', sections: Object.keys(payload), payload }
    const current = { sections: { agency: { enabled: false } } }
    assert.deepEqual(await inspectImportCode('ABCDEFGH', current, async () => ({ status: 200, data: share, headers: {}, url: '' })), await inspectPreset({ http: { get: async () => share } } as never, 'ABCDEFGH', current))
  }
})

test('hostless preview preserves upstream share validation and useful network errors', async () => {
  for (const status of [404, 429, 503]) {
    await assert.rejects(inspectImportCode('ABCDEFGH', {}, async () => ({ status, data: {}, headers: {}, url: '' })), /不存在|限流|异常状态/)
  }
  await assert.rejects(inspectImportCode('bad', {}, async () => { throw new Error('must not fetch') }), /分享码格式/)
  await assert.rejects(inspectImportCode('ABCDEFGH', {}, async () => { throw new Error('offline') }), /无法连接分享站/)
  await assert.rejects(inspectImportCode('ABCDEFGH', {}, async () => ({ status: 200, data: { code: '00000000' }, headers: {}, url: '' })), /分享码与请求不一致/)
})
