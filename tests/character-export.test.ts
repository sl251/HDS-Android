import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'yaml'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { sanitizeSharePayload as browserSanitize } from '../apps/mobile-ui/share-sanitizer.js'
import { buildPresetPayload, buildTavernCard, createCharacterExport, saveCharacterExport } from '../apps/mobile-ui/character-export'
import { parseJsonCard } from '../packages/card-format'
import { storyDefaultsToSettingPatch } from '../upstream/hds-interlude/src/share-sync'

const setting = {
  character: { name: '星禾', profile: '修理收音机。\n保留中文与换行。', personality: '温和', apiKey: 'NESTED_SECRET' },
  user: { displayName: '我', profile: '老朋友' }, world: '海边小镇', relationship: '朋友', location: '维修铺', perspective: '第二人称',
  perspectives: ['她的日常', '你的来信'], supplementaryFacts: ['带维修手册'], supportingCast: '邻居', style: '自然', timezone: 'Asia/Shanghai',
  firstMessage: '你来了。', examples: '你好！', systemPrompt: '保持角色视角', apiKey: 'SECRET', endpoint: 'https://secret.example', token: 'TOKEN_SECRET', phone: '13800138000', qq: '123456789',
  worldbook: { entries: [{ content: '海风很大', keys: ['海'], enabled: true, endpoint: 'https://lore-secret.example', extensions: { token: 'LORE_SECRET' } }] },
}
const config = { sections: {
  agency: { enabled: true, nested: [{ apiKey: 'CONFIG_SECRET', endpoint: 'https://config-secret.example', token: 'CONFIG_TOKEN', safe: true }], qq: '123456789', mobile: '13800138000', qqNumber: '987654321', phoneNumber: '13900139000' },
  runtime: { autoAdvanceEnabled: false }, model: { apiKey: 'MODEL_SECRET' }, onebot: { token: 'QQ_SECRET' }, embedding: { enabled: true },
} }
const forbidden = /apiKey|endpoint|token|SECRET|secret\.example|13800138000|123456789|987654321|13900139000/i

test('ST V2 exports current story fields, a compatible book and no connection or contact fields', () => {
  const before = JSON.stringify(setting)
  const file = createCharacterExport('tavern', setting, config)
  const card = JSON.parse(file.content)
  assert.equal(card.spec, 'chara_card_v2'); assert.equal(card.spec_version, '2.0')
  assert.equal(card.data.name, setting.character.name); assert.equal(card.data.description, setting.character.profile)
  assert.equal(card.data.personality, '温和'); assert.equal(card.data.first_mes, '你来了。')
  assert.equal(card.data.mes_example, '你好！'); assert.equal(card.data.system_prompt, '保持角色视角')
  assert.equal(card.data.creator_notes, '由 HDS-Interlude 导出')
  assert.equal(card.data.character_book.entries[0].content, '海边小镇')
  assert.deepEqual(card.data.character_book.entries[1].keys, ['海'])
  assert.doesNotMatch(file.content, forbidden)
  assert.equal(parseJsonCard(file.content).description, setting.character.profile)
  assert.equal(JSON.stringify(setting), before)
})

test('preset export reuses upstream whitelist/deep sanitizer and flattens current story for typ0 import', () => {
  const before = JSON.stringify(config)
  const file = createCharacterExport('preset', setting, config)
  const preset = JSON.parse(file.content)
  assert.deepEqual(Object.keys(preset).sort(), ['agency', 'runtime', 'storyDefaults'])
  assert.equal(preset.storyDefaults.characterName, '星禾'); assert.equal(preset.storyDefaults.characterProfile, setting.character.profile)
  assert.equal(preset.storyDefaults.userProfile, '老朋友')
  assert.equal(preset.storyDefaults.character, undefined); assert.equal(preset.sections, undefined)
  assert.deepEqual(preset.agency.nested, [{ safe: true }])
  assert.doesNotMatch(file.content, forbidden)
  const roundtrip = storyDefaultsToSettingPatch(preset.storyDefaults)
  assert.deepEqual(roundtrip.character, { name: '星禾', profile: setting.character.profile })
  assert.deepEqual(roundtrip.perspectives, setting.perspectives); assert.equal(roundtrip.world, setting.world)
  assert.equal(JSON.stringify(config), before)
})

test('YAML view round trips booleans, arrays, multiline and ambiguous/special strings without type loss', () => {
  const source = { character: { name: 'null', profile: 'a: b\n# comment\n中文 "引号"' }, world: 'true', perspectives: ['yes', '001', 'a: b', '- item'], supplementaryFacts: [] }
  const options = { sections: { agency: { enabled: false, count: 0, ratio: 0.5, empty: null, values: [true, 1, 'false'] } } }
  const file = createCharacterExport('yaml', source, options)
  assert.equal(file.mime, 'text/yaml'); assert.match(file.filename, /\.yaml$/)
  assert.deepEqual(parse(file.content), buildPresetPayload(source, options))
})

test('minimal and alias fields export safely; absent optional fields stay empty and malformed settings fail', () => {
  const card = buildTavernCard({ characterName: '角色', persona: '人设' })
  assert.equal(card.data.description, '人设'); assert.equal(card.data.first_mes, ''); assert.equal(card.data.mes_example, '')
  assert.equal('character_book' in card.data, false)
  for (const value of [undefined, null, [], {}, { character: { name: 12 } }]) assert.throws(() => createCharacterExport('preset', value), /人设|角色名/)
  assert.doesNotMatch(createCharacterExport('tavern', { name: '../A:/卡', description: '联系电话 13800138000，QQ号：123456789；sk-abcdefgh1234', accessToken: 'OTHER_SECRET' }).content, forbidden)
  assert.doesNotMatch(createCharacterExport('preset', { name: '../A:/卡' }).filename, /[/\\:]/)
})

test('App export writes and closes a private file, and aborts failed writes without reporting a path', async t => {
  const events: unknown[] = []
  let fail = false
  const writer = { write: async (content: string) => { events.push(content); if (fail) throw new Error('disk full') }, close: async () => { events.push('close') }, abort: async () => { events.push('abort') } }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  t.after(() => { if (original) Object.defineProperty(globalThis, 'navigator', original); else Reflect.deleteProperty(globalThis, 'navigator') })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { getDirectory: async () => ({ getDirectoryHandle: async (directory: string) => {
    assert.equal(directory, 'hds-exports')
    return { getFileHandle: async (filename: string) => { events.push(filename); return { createWritable: async () => writer } } }
  } }) } } })
  const file = createCharacterExport('preset', setting)
  assert.equal(await saveCharacterExport(file, true), `opfs:/hds-exports/${file.filename}`)
  assert.deepEqual(events, [file.filename, file.content, 'close'])
  fail = true; events.length = 0
  await assert.rejects(saveCharacterExport(file, true), /disk full/)
  assert.deepEqual(events, [file.filename, file.content, 'abort'])
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  await assert.rejects(saveCharacterExport(file, true), /WebView/)
})

test('browser sanitizer stays generated from the exact upstream source', async () => {
  const source = await readFile(new URL('../upstream/hds-interlude/src/share-sync.ts', import.meta.url))
  const generated = await readFile(new URL('../apps/mobile-ui/share-sanitizer.js', import.meta.url), 'utf8')
  assert.ok(generated.includes(`sha256: ${createHash('sha256').update(source).digest('hex')}`), 'Run node apps/mobile-ui/build-share-sanitizer.mjs after changing upstream')
  assert.deepEqual(browserSanitize({ storyDefaults: setting, ...config.sections }).preset.agency, { enabled: true, nested: [{ safe: true }], qq: '123456789', mobile: '13800138000', qqNumber: '987654321', phoneNumber: '13900139000' })
})
