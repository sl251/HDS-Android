import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectSharedCharacter, prepareCharacterImport } from '../apps/mobile-ui/character-import'
import { createSavedCharacterExport } from '../apps/mobile-ui/character-export'
import { parsePersona, editPersona } from '../packages/persona-format'
import { parseJsonCard, fromBase64 } from '../packages/card-format'

const payload = { storyDefaults: { characterName: '新角色', characterProfile: '人设\n第二行', world: '小镇', perspectives: ['甲', '乙'] }, agency: { enabled: true }, model: { apiKey: 'DO_NOT_IMPORT' } }
let revision = 1
const get = async (options: { url: string }) => {
  assert.equal(options.url, 'https://typ0.space/api/share/ABCDEFGH')
  return { status: 200, data: { code: 'ABCDEFGH', revision, title: '新角色预设', sections: Object.keys(payload), payload }, headers: {}, url: options.url }
}
test('share import prepares a persisted persona without a selected story or host; checks revision before saving', async () => {
  revision = 1
  const preview = await inspectSharedCharacter('abcd-efgh', undefined, get)
  assert.equal(preview.card.name, '新角色')
  assert.equal(preview.card.hds?.storyDefaults.world, '小镇')
  assert.deepEqual(parsePersona(fromBase64(preview.base64))[0].hds, preview.card.hds)
  assert.doesNotMatch(new TextDecoder().decode(fromBase64(preview.base64)), /DO_NOT_IMPORT|agency|model/)
  assert.deepEqual((await inspectSharedCharacter('ABCDEFGH', preview.fingerprint, get)).card, preview.card)
  revision = 2
  await assert.rejects(inspectSharedCharacter('ABCDEFGH', preview.fingerprint, get), /分享内容已变化/)
})
test('share import rejects pure life settings, malformed codes, gateway data, mismatched code and HTTP failures', async () => {
  await assert.rejects(inspectSharedCharacter('bad', undefined, get), /分享码格式/)
  for (const [status, data, message] of [
    [404, {}, /不存在/], [429, {}, /限流/], [200, '<html>bad gateway</html>', /格式异常/],
    [200, { code: 'ABCDEFGJ', revision: 1, sections: [], payload }, /不一致/],
    [200, { code: 'ABCDEFGH', revision: 1, sections: ['agency'], payload: { agency: { enabled: true } } }, /人设/],
  ] as const) await assert.rejects(inspectSharedCharacter('ABCDEFGH', undefined, async () => ({ status, data, headers: {}, url: '' })), message)
})
test('named HDS envelopes are parsed as presets instead of empty Tavern cards', () => {
  for (const input of [{ name: '标题', payload }, { name: '标题', preset: { payload } }, { name: '标题', ...payload }]) {
    const card = parsePersona(new TextEncoder().encode(JSON.stringify(input)))[0]
    assert.equal(card.format, 'hds'); assert.equal(card.name, '新角色'); assert.equal(card.description, payload.storyDefaults.characterProfile)
  }
})
test('edited V1/V2/V3 exports preserve card fields, alternate greetings, lore and inert extensions on reimport', () => {
  const data = { name: '原名', description: '原描述', personality: '温柔', scenario: '旧世界', first_mes: '原开场', alternate_greetings: ['你好', '晚安'], mes_example: '例子', system_prompt: '系统人设', post_history_instructions: '尾部提示', creator_notes: '备注', tags: ['中文'], extensions: { custom: { kept: true }, apiKey: 'SECRET' }, character_book: { entries: [{ id: 3, keys: ['测试'], content: '世界书正文', enabled: true }] } }
  for (const version of ['v1', 'v2', 'v3'] as const) {
    const raw = version === 'v1' ? data : { spec: version === 'v2' ? 'chara_card_v2' : 'chara_card_v3', spec_version: version === 'v2' ? '2.0' : '3.0', data }
    const card = parseJsonCard(JSON.stringify(raw))
    const edited = editPersona(card, { ...card, name: '编辑后的名字', firstMessage: '编辑后的开场', postHistoryInstructions: '编辑后的尾部', description: '新的描述' })
    const before = JSON.stringify(edited)
    for (const format of ['original', 'tavern'] as const) {
      const file = createSavedCharacterExport(format, edited)
      const imported = parsePersona(new TextEncoder().encode(file.content))[0]
      assert.equal(imported.name, edited.name); assert.equal(imported.description, edited.description)
      assert.equal(imported.firstMessage, edited.firstMessage); assert.equal(imported.postHistoryInstructions, edited.postHistoryInstructions)
      assert.deepEqual(imported.alternateGreetings, card.alternateGreetings); assert.deepEqual(imported.lorebook, card.lorebook)
      assert.doesNotMatch(file.content, /SECRET|apiKey/); assert.match(file.content, /"kept": true/)
      if (format === 'original') assert.equal(imported.format, version)
    }
    assert.equal(JSON.stringify(edited), before)
  }
})
test('native HDS exports round trip character identity and story defaults in original/JSON/YAML formats', () => {
  const card = parsePersona(new TextEncoder().encode(JSON.stringify(payload)))[0]
  for (const format of ['original', 'preset', 'yaml'] as const) {
    const file = createSavedCharacterExport(format, card)
    const imported = parsePersona(new TextEncoder().encode(file.content))[0]
    assert.equal(imported.name, card.name); assert.deepEqual(imported.hds, card.hds)
    assert.deepEqual(prepareCharacterImport(imported).card.hds, card.hds)
  }
})
