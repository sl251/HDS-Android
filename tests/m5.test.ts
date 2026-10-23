import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { voiceInstruction, systemPrompt } from '../upstream/hds-interlude/src/narrator'
import { localVoiceCapability, localVoiceDelivery } from '../runtime/voice'
import { messageAudio, mergeMessages, voiceText } from '../packages/contracts'
import { stripMediaMarkers, MessageContent } from '../apps/mobile-ui/MessageContent'
import { VoiceBubble } from '../apps/mobile-ui/Voice'
import { parseJsonCard } from '../packages/card-format'
import type { HostConfig } from '../runtime/host'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const until = async (check: () => Promise<boolean>) => { for (let n = 0; n < 200; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)) }; throw new Error('M5 condition timed out') }
const audio = { audioId: 'a'.repeat(64), duration: 1.2 }

test('M5 voice capability is absent by default, off instruction is exactly empty, enabled schema includes restrained willingness', () => {
  assert.equal(voiceInstruction(), '')
  assert.equal(voiceInstruction({ platform: 'local', quoteReply: false, reactions: [], voice: { enabled: false } }), '')
  const capability = { platform: 'local' as const, quoteReply: false, reactions: [], voice: { enabled: true, threshold: .8 } }
  assert.match(voiceInstruction(capability), /voice: \{"willingness":0.0-1.0\}/)
  assert.match(voiceInstruction(capability), /仅在情绪强烈或氛围合适时使用；文字本身永远是主体/)
  assert.match(voiceInstruction(capability), /reaches 0.8/)
  const off = systemPrompt('user-message', '', '', '', '', '')
  assert.doesNotMatch(off, /CURRENT LOCAL VOICE|voice:|"willingness".*audio/)
  assert.match(systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false, capability, false, [], false, false, false, false, undefined, { tier: 'lite', family: 'generic' } as any), /CURRENT LOCAL VOICE OPTION/)
  assert.equal(localVoiceCapability(), undefined)
  const directory = mkdtempSync(join(tmpdir(), 'm5-capability-')), bridge = { url: 'http://127.0.0.1:1/synthesize', token: 'fixture', cardId: 'first', directory }
  try {
    assert.equal(localVoiceCapability(bridge), undefined)
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ characters: { first: { enabled: false } } }))
    assert.equal(localVoiceCapability(bridge), undefined)
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ characters: { second: { enabled: true } } }))
    assert.equal(localVoiceCapability(bridge), undefined)
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ characters: { first: { enabled: true, threshold: .9 } } }))
    assert.deepEqual(localVoiceCapability(bridge), { enabled: true, threshold: .9 })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('M5 old message JSON remains readable and audio participates in message reconciliation', () => {
  for (const value of [undefined, null, {}, [], 'id', { ...audio, duration: -1 }, { ...audio, duration: Infinity }, { ...audio, audioId: '../private' }]) assert.equal(messageAudio(value), undefined)
  assert.deepEqual(messageAudio(audio), audio)
  const old = { id: 'old', direction: 'character' as const, content: '历史文字', occurredAt: '2026-10-17T00:00:00Z', status: 'delivered' }
  const first = mergeMessages([], [old]); assert.equal(first[0].audio, undefined)
  const next = mergeMessages(first, [{ ...old, audio }]); assert.deepEqual(next[0].audio, audio); assert.notEqual(next, first)
  assert.equal(mergeMessages(next, [{ ...old, audio }]), next)
})

test('M5 transcript and TTS strip media markers and reasoning while preserving ordinary prose', () => {
  const text = '<think>绝不能念出这段思考</think>今天真开心！[语音]【音频: mock】[voice wav][audio]【贴纸】[普通括号]'
  assert.equal(voiceText(text), '今天真开心！[普通括号]')
  assert.equal(stripMediaMarkers('[表情包]【图片】[sticker x][voice]你好[普通]'), '你好[普通]')
  const bubble = renderToStaticMarkup(React.createElement(VoiceBubble, { audio, content: text, bridge: {} as any }))
  assert.match(bubble, /播放语音/); assert.match(bubble, /2 秒/); assert.match(bubble, /展开文字稿/); assert.doesNotMatch(bubble, /今天真开心|绝不能念出/)
  const plain = renderToStaticMarkup(React.createElement(MessageContent, { message: { content: '今天[语音]真开心[普通]' } }))
  assert.match(plain, /今天真开心\[普通\]/); assert.doesNotMatch(plain, /播放语音/)
})

test('M5 bridge failures, invalid metadata and non-loopback endpoints silently fall back to text', async () => {
  assert.equal(await localVoiceDelivery(undefined, '文字保留', .9, '风格'), undefined)
  assert.equal(await localVoiceDelivery({ url: 'https://example.com/synthesize', token: '', cardId: '', directory: '' }, '文字保留', .9, ''), undefined)
  assert.equal(await localVoiceDelivery({ url: 'http://127.0.0.1:1/synthesize', token: '', cardId: '', directory: '' }, '文字保留', .9, ''), undefined)
})

test('M5 real HDS decisions reach final local text + one audio record; legacy SQLite migrates; disabling and failed TTS preserve text', { timeout: 90000 }, async () => {
  const requests: any[] = [], synthesis: any[] = []
  let willingness: unknown = .95, failTts = false
  let replyContent = '今天真开心。'
  const model = createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk
    const body = JSON.parse(text); requests.push(body)
    const decision = { script: `星禾看了眼手机，心里很开心，给小林发消息：“${replyContent}”`, interaction: { seen: true, reply: { mode: 'immediate', content: replyContent } }, voice: { willingness } }
    if (body.stream) { res.setHeader('Content-Type', 'text/event-stream'); res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(decision) } }] })}\n\ndata: [DONE]\n\n`) }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] })) }
  })
  const tts = createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk
    synthesis.push({ ...JSON.parse(text), auth: req.headers.authorization })
    res.setHeader('Content-Type', 'application/json'); if (failTts) res.statusCode = 503
    res.end(JSON.stringify(failTts ? {} : audio))
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve)); await new Promise<void>(resolve => tts.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as any).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-m5-host-')), directory = join(dataDir, 'voice'); mkdirSync(directory)
  const voiceBridge = { url: `http://127.0.0.1:${(tts.address() as any).port}/synthesize`, token: 'private-fixture-token', cardId: 'first', directory }
  const enable = (enabled: boolean) => writeFileSync(join(directory, 'settings.json'), JSON.stringify({ characters: { first: { enabled, threshold: .7 } } }))
  const config: HostConfig = { modelOptions: { mainStreamingMode: 'experimental' }, card: parseJsonCard(JSON.stringify({ name: '星禾', description: '小林的邻居', personality: '开朗温柔' })), endpoint: `http://127.0.0.1:${(model.address() as any).port}/v1/chat/completions`, model: 'm5-fixture', userName: '小林', userProfile: '邻居', autoAdvance: false, token: 'm5-test-token-longer-than-32-characters', port, dataDir }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    // Create a real pre-M5 database without audio, then load it through the new host.
    const require = createRequire(import.meta.url); const { Context } = require('koishi'); const { SQLiteDriver } = require('@minatojs/driver-sqlite')
    const app = new Context(); app.plugin(SQLiteDriver, { path: join(dataDir, 'hds.sqlite') })
    app.model.extend('mobile_message' as never, { id: 'string', direction: 'string', content: 'text', occurredAt: 'timestamp', status: 'string', images: { type: 'json', initial: [] } } as never, { primary: 'id' } as never)
    await app.start(); await app.database.create('mobile_message' as never, { id: 'legacy', direction: 'character', content: '历史记录仍在', occurredAt: new Date('2026-01-01'), status: 'delivered', images: {} } as never); await app.stop()
    host = await startHost({ ...config, voiceBridge })
    const history = async () => await host!.dispatch('messages.history', {}) as any[]
    assert.equal((await history())[0].content, '历史记录仍在'); assert.equal((await history())[0].audio, undefined)
    enable(true)
    await host.dispatch('messages.sendLocal', { requestId: 'm5-voice-main-request', content: '今天开心吗？' })
    await until(async () => (await history()).some(row => row.audio))
    const row = (await history()).find(row => row.audio)
    assert.equal(row.content, '今天真开心。'); assert.deepEqual(row.audio, audio)
    assert.equal((await history()).filter(row => row.direction === 'character').length, 2)
    assert.equal(synthesis[0].text, row.content); assert.equal(synthesis[0].willingness, .95)
    assert.equal(synthesis[0].auth, 'Bearer private-fixture-token'); assert.match(synthesis[0].style, /开朗温柔/)
    assert.match(requests[0].messages[0].content, /CURRENT LOCAL VOICE OPTION/)
    assert.equal(requests[0].stream, true, 'voice-enabled turns stream text while audio waits for the complete voice decision')
    assert.equal(JSON.stringify(requests[0]).includes('private-fixture-token'), false)
    failTts = true
    await host.dispatch('messages.sendLocal', { requestId: 'm5-tts-failure-request', content: '再说一次吧' })
    await until(async () => (await history()).filter(row => row.direction === 'character').length === 3)
    assert.equal((await history()).at(-1).content, '今天真开心。'); assert.equal((await history()).at(-1).audio, undefined)
    enable(false)
    await host.dispatch('messages.sendLocal', { requestId: 'm5-disabled-request', content: '今天真好' })
    await until(async () => (await history()).filter(row => row.direction === 'character').length === 4)
    assert.doesNotMatch(requests.at(-1).messages[0].content, /CURRENT LOCAL VOICE OPTION|voice: \{/)
    assert.equal(requests.at(-1).stream, true, 'disabled voice preserves experimental early text delivery')
    assert.equal((await history()).at(-1).audio, undefined) // Failed native synthesis cannot replace text.
    enable(true); failTts = false
    replyContent = '第一段语音。<sep/>第二段语音。'
    const beforeSplit = synthesis.length
    Object.assign(host.app.interlude.config.runtime, { typingBaseDelaySeconds: 0, typingMaxDelaySeconds: 0, typingJitterRatio: 0 })
    await host.dispatch('messages.sendLocal', { requestId: 'm5-split-voice-request', content: '分两句说吧' })
    await until(async () => (await history()).filter(row => row.direction === 'character').length === 6)
    assert.deepEqual(synthesis.slice(beforeSplit).map(row => [row.text, row.willingness]), [['第一段语音。', .95], ['第二段语音。', .95]])
    assert.ok((await history()).filter(row => row.direction === 'character').slice(-2).every(row => row.audio))
    const splits = await host.app.database.get('interlude_intent', { type: 'split-message' })
    assert.ok(splits.some((intent: any) => intent.payload.mobileVoice?.willingness === .95))
    const scripts = await host.app.database.get('interlude_script_entry', { kind: 'script' })
    assert.ok(scripts.some((entry: any) => entry.metadata?.scriptEvents?.some((event: any) => event.kind === 'outgoing-message' && event.metadata?.mobileVoice?.willingness === .95)))
    // Exercise the compiled outbox reconstruction against a durable pending row.
    // This isolates recovery from the scheduler so it cannot race a live timer.
    const entry = structuredClone(scripts.find((entry: any) => entry.metadata?.scriptEvents?.some((event: any) => event.metadata?.mobileVoice?.willingness === .95))) as any
    for (const action of entry.metadata.deliveryActions) {
      action.status = 'pending'
      for (const segment of action.segments) segment.status = 'pending'
    }
    const service = host.app.interlude as any
    const recovered: any[] = []
    const recovery = {
      taskGeneration: () => 1, taskGenerationCurrent: () => true,
      getStory: async () => ({ id: entry.storyId, status: 'active' }),
      dbGet: async (table: string) => table === 'interlude_script_entry' ? [entry] : [],
      pendingOutgoingDeliveryCandidates: service.pendingOutgoingDeliveryCandidates,
      interruptedTypingParticipants: new Set(), getParticipant: async () => ({ status: 'active' }),
      deliverOutgoingMessages: async (_story: unknown, messages: any[]) => {
        recovered.push(...messages)
        for (const action of entry.metadata.deliveryActions) for (const segment of action.segments) segment.status = 'delivered'
      },
    }
    const candidate = service.pendingOutgoingDeliveryCandidates(entry)[0]
    assert.ok(candidate)
    assert.equal(await service.recoverPendingDeliveryCandidate.call(recovery, { id: entry.storyId }, candidate), 'delivered')
    assert.deepEqual(recovered[0].voice, { willingness: .95 })
    await host.stop(); host = undefined
    host = await startHost({ ...config, voiceBridge }); assert.deepEqual((await host.dispatch('messages.history', {}) as any[]).find(item => item.id === row.id)?.audio, audio)
  } finally { if (host) await host.stop(); await new Promise<void>(resolve => model.close(() => resolve())); await new Promise<void>(resolve => tts.close(() => resolve())); rmSync(dataDir, { recursive: true, force: true }) }
})
