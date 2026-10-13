import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePersona, importBytes, editPersona } from '../packages/persona-format'
import { personaDefaults, personaEditPatch } from '../runtime/persona'

const encode = (text: string) => new TextEncoder().encode(text)
const download = `plugins:
  group:story:
    hds-interlude:fixture:
      storyDefaults:
        characterName: 星禾
        characterProfile: |-
          住在海边，修理收音机。
          保留换行与中文。
        world: 海边城镇
        location: 修理铺
        relationship: 老朋友
        perspective: 第二人称
        perspectives: [她的日常, 你的来信]
        supplementaryFacts: [有一本维修手册]
        supportingCast: 邻居小林
        style: 自然克制
        userProfile: 原预设用户
        timezone: Asia/Shanghai
      model:
        apiKey: SECRET_MUST_DISAPPEAR
        endpoint: https://secret.example.com/v1
      onebot:
        token: QQ_SECRET
      runtime:
        autoAdvanceEnabled: true
`
test('typ0-style koishi YAML keeps native persona semantics and never persists connection secrets', () => {
  const [card] = parsePersona(encode(download))
  assert.equal(card.format, 'hds'); assert.equal(card.name, '星禾'); assert.match(card.description, /\n保留换行/)
  const defaults = personaDefaults(card, '本机用户')
  assert.equal(defaults.location, '修理铺'); assert.equal(defaults.relationship, '老朋友')
  assert.deepEqual(defaults.perspectives, ['她的日常', '你的来信']); assert.equal(defaults.userProfile, '本机用户')
  assert.equal(personaDefaults(card, '').userProfile, '原预设用户')
  assert.doesNotMatch(JSON.stringify(card), /SECRET_MUST_DISAPPEAR|QQ_SECRET|secret\.example/)
  assert.doesNotMatch(new TextDecoder().decode(importBytes(card, encode(download))), /apiKey|onebot|autoAdvanceEnabled/)
  assert.match(card.warnings.join(' '), /未导入.*model/)
  assert.equal(parsePersona(importBytes(card, encode(download)))[0].name, card.name)
})
test('direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently', () => {
  const persona = { storyDefaults: { characterName: 'A', characterProfile: 'profile' } }
  for (const input of [persona, { payload: persona }, { preset: { payload: persona } }]) assert.equal(parsePersona(encode(JSON.stringify(input)))[0].name, 'A')
  const candidates = parsePersona(encode(JSON.stringify({ plugins: { 'group:test': { 'hds-interlude:a': persona, 'hds-interlude:b': { storyDefaults: { characterName: 'B', characterProfile: 'other' } } } } })))
  assert.deepEqual(candidates.map(card => card.name), ['A', 'B'])
})
test('unsupported YAML constructs and oversized native fields fail without echoing secrets', () => {
  for (const input of ['a: &a { secret: sensitive }\nstoryDefaults: *a', 'x: 1\nx: 2', 'x: !!js/function secret', '---\na: 1\n---\nb: 2']) assert.throws(() => parsePersona(encode(input)), /无法解析/)
  assert.throws(() => parsePersona(encode('{"storyDefaults":{"characterName":"A","characterProfile":"x"},"__proto__":{"a":1}}')), /对象键/)
  assert.throws(() => parsePersona(encode(JSON.stringify({ storyDefaults: { characterName: 'x'.repeat(61), characterProfile: 'a' } }))), /60/)
  assert.throws(() => parsePersona(encode('{"runtime":{"autoAdvanceEnabled":true}}')), /未找到/)
})
test('editing preserves Tavern extensions and HDS native fields while reflecting the current persona', () => {
  const tavern = parsePersona(encode(JSON.stringify({ spec: 'chara_card_v2', data: { name: 'A', description: 'old', extensions: { untouched: true }, character_book: { entries: [] } } })))[0]
  const updated = editPersona(tavern, { ...tavern, name: 'B', description: 'new' })
  assert.equal(updated.name, 'B'); assert.equal((updated.raw.data as any).extensions.untouched, true)
  assert.equal(tavern.name, 'A')
  const hds = parsePersona(encode(download))[0]
  const edited = editPersona(hds, { ...hds, description: '改过的角色', scenario: '' })
  const patch = personaEditPatch(edited)
  assert.equal(patch.character?.profile, '改过的角色'); assert.equal(patch.location, '修理铺')
  assert.equal(patch.world, ''); assert.equal(patch.user, undefined)
})
