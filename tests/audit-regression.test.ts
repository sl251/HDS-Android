import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hostMethods } from '../packages/contracts/rpc'
import { withOneBotVoice } from '../scripts/mobile-onebot-voice.mjs'
import { canonical, settingPatch, settingRevision } from '../runtime/story-setting'
import { scriptEventPayload, restoreDesktopContext, prepareOutgoingDelivery } from '../upstream/hds-interlude/src/delivery'
import { voiceText } from '../packages/contracts/voice'

test('audit: shared RPC contract covers every UI literal and exactly matches the generated native allowlist', () => {
  const native = readFileSync('android/app/src/main/java/io/hdsinterlude/android/RuntimeContract.kt', 'utf8')
  const methods = [...native.slice(native.indexOf('val methods')).matchAll(/"([^"]+)"/g)].map(row => row[1])
  assert.deepEqual(methods, hostMethods)
  assert.ok(methods.includes('story.applySetting'))
  for (const path of ['apps/mobile-ui/main.tsx', 'apps/mobile-ui/LifeSettings.tsx', 'apps/mobile-ui/StorySettingEditor.tsx']) {
    const source = readFileSync(path, 'utf8')
    for (const [, method] of source.matchAll(/method: '([^']+)'/g)) assert.ok([...hostMethods, 'models.test', 'models.list', 'preset.commit', 'preset.commitStatus'].includes(method as never), `${path}: ${method}`)
  }
})
test('audit: voice overlay handles LF/CRLF, preserves quote transport and injects sessionless capability', () => {
  const source = readFileSync('upstream/hds-interlude/src/service.ts', 'utf8').replace(/\r\n/g, '\n')
  const overlaid = withOneBotVoice(source)
  assert.equal(withOneBotVoice(source.replace(/\n/g, '\r\n')), overlaid)
  assert.equal(withOneBotVoice(overlaid), overlaid)
  assert.match(overlaid, /mobileOneBotVoiceDelivery\?\.\(bot, transportGroupId, segment, voice\?\.willingness/)
  assert.match(overlaid, /bot.sendMessage\(transportGroupId, outgoing\)/)
  assert.match(overlaid, /if \(groupContext \|\|/)
  assert.doesNotMatch(overlaid, /\(this.config.model as any\).mobileOneBotVoice/)
  assert.equal(voiceText('<at id="123"/>正文【表情包：开心】<think>隐藏</think>'), '正文')
})
test('audit: delayed segments and restart recovery retain final voice intent, trace and original group target', () => {
  const message = { participantId: 'group:88888', content: '第一段<sep/>第二段', voice: { willingness: .95 }, traceId: 'fixture-trace' }
  const first = prepareOutgoingDelivery(message, ['第一段', '第二段'])!
  const payload = JSON.parse(JSON.stringify({ ...scriptEventPayload(first, 1), content: '第二段', participantId: message.participantId }))
  assert.equal(payload.participantId, 'group:88888')
  assert.deepEqual(restoreDesktopContext(payload), { voice: { willingness: .95 }, traceId: 'fixture-trace' })
  for (const willingness of [-1, 2, '1', null]) assert.equal(restoreDesktopContext({ voice: { willingness } }).voice, undefined)
})
test('audit: revision hashing is key-order independent and setting patches reject host-control fields', () => {
  assert.equal(canonical({ b: 1, a: { z: 2 } }), canonical({ a: { z: 2 }, b: 1 }))
  assert.equal(settingRevision({ a: 1, b: 2 }), settingRevision({ b: 2, a: 1 }))
  assert.notEqual(settingRevision({ a: 1 }), settingRevision({ a: 2 }))
  assert.deepEqual(settingPatch({ user: { displayName: '朋友', profile: '' }, character: { name: '星禾' }, perspectives: [] }), { user: { displayName: '朋友', profile: '' }, character: { name: '星禾' }, perspectives: [] })
  for (const value of [{ model: 'forbidden' }, { character: { apiKey: 'fixture' } }, { world: 42 }, { supplementaryFacts: [null] }]) assert.throws(() => settingPatch(value))
})
