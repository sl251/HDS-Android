import test from 'node:test'
import assert from 'node:assert/strict'
import { stickerImportReason } from '../apps/mobile-ui/sticker-state'
import { defaultOptions, newProvider } from '../apps/mobile-ui/ModelCenter'
import { mobileVoicePrompt, normalizeVoiceDecision } from '../runtime/voice-decision'
import { voiceInstruction, stickerInstruction } from '../upstream/hds-interlude/src/narrator'
import { oneBotVoiceDelivery } from '../runtime/voice'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('sticker imports require a configured vision route before opening the picker', () => {
  const provider = { ...newProvider(), endpoint: 'https://example.com/v1', model: 'vision', enabled: true, useForMain: true, imageInput: 'supported' as const }
  const settings = { providers: [provider], modelOptions: { ...defaultOptions, visionEnabled: true } }
  assert.equal(stickerImportReason(settings), undefined)
  assert.match(stickerImportReason({ ...settings, modelOptions: { ...settings.modelOptions, visionEnabled: false } })!, /开启图片理解/)
  for (const providers of [[], [{ ...provider, model: '' }], [{ ...provider, endpoint: '' }], [{ ...provider, enabled: false }], [{ ...provider, imageInput: 'unsupported' as const }]]) assert.ok(stickerImportReason({ ...settings, providers }))
  assert.ok(stickerImportReason({ ...settings, modelOptions: { ...settings.modelOptions, visionProviderId: 'missing' } }))
  assert.equal(stickerImportReason({ ...settings, providers: [{ ...provider, id: 'vision', useForMain: false }], modelOptions: { ...settings.modelOptions, visionProviderId: 'vision' } }), undefined)
})

test('voice extension preserves upstream sticker choices and both configured thresholds', () => {
  assert.equal(mobileVoicePrompt('ordinary prompt'), 'ordinary prompt')
  const voice = { enabled: true, threshold: .85 }
  const stickers = stickerInstruction([{ assetId: 'x', group: 'g', description: '开心', aliases: [], animated: true }], .45)
  const prompt = mobileVoicePrompt(voiceInstruction({ platform: 'local', quoteReply: false, reactions: [], voice }) + '\n' + stickers, voice)
  assert.ok(prompt.endsWith(stickers), 'The upstream sticker prompt is unchanged')
  assert.match(prompt, /standalone\|after-text/)
  assert.match(prompt, /reaches 0.85/); assert.match(prompt, /reaches 0.45/)
  assert.match(prompt, /TOP LEVEL/)
  assert.doesNotMatch(prompt, /daily|文字本身永远是主体/)
  for (const value of [undefined, null, {}, [], { willingness: '0.9' }, { willingness: NaN }, { willingness: Infinity }, { willingness: -1 }, { willingness: 1.1 }]) assert.equal(normalizeVoiceDecision(value), undefined)
  for (const willingness of [0, .9, 1]) assert.deepEqual(normalizeVoiceDecision({ willingness, extra: 'ignored' }), { willingness })
})

test('voice success returns its receipt; transport uncertainty sends no fallback text', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'media-choice-')), id = 'a'.repeat(64)
  const wav = Buffer.alloc(44 + 24000 * 2)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  writeFileSync(join(directory, id + '.wav'), wav)
  let texts = 0, syntheses = 0
  const api = createServer(async (req, res) => { for await (const _ of req) {} syntheses++; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ audioId: id, duration: 1 })) })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const bridge = { directory, cardId: 'first', token: '', url: `http://127.0.0.1:${(api.address() as any).port}/synthesize` }
  const fallback = async () => { texts++; return ['text'] }
  try {
    const bot = { platform: 'onebot', sendMessage: async (_: string, content: string) => { assert.match(content, /^<audio /); return ['voice'] } }
    assert.deepEqual(await oneBotVoiceDelivery(bridge, bot, 'group:1', ['<quote id="1"/>', '你好'], .9, '', fallback), ['voice'])
    assert.equal(texts, 0)
    for (const sendMessage of [async () => { throw new Error('connection lost') }, ...[[], undefined, null, '', [''], [null]].map(receipt => async () => receipt as any)]) {
      await assert.rejects(oneBotVoiceDelivery(bridge, { ...bot, sendMessage }, '1', '你好', .9, '', fallback), /transport-timeout:voice-send/)
      assert.equal(texts, 0)
    }
    assert.deepEqual(await oneBotVoiceDelivery(bridge, { ...bot, sendMessage: async () => { throw Object.assign(new Error('rejected'), { code: 1200 }) } }, '1', '你好', .9, '', fallback), ['text'])
    const before = syntheses
    await oneBotVoiceDelivery(bridge, bot, '1', '<img src="local.gif"/>', .9, '', fallback)
    assert.equal(syntheses, before, 'Stickers never trigger TTS')
  } finally { await new Promise<void>(resolve => api.close(() => resolve())); rmSync(directory, { recursive: true, force: true }) }
})
