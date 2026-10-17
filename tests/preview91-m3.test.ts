import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import { decode, isSilk, getDuration } from 'silk-wasm'
import { oneBotVoiceDelivery, type VoiceBridgeConfig } from '../runtime/voice'
import { wavToSilk } from '../runtime/voice-codec'
import { parseJsonCard } from '../packages/card-format'
import { newQQGroup } from '../packages/contracts'
import { withOneBotVoice } from '../scripts/mobile-onebot-voice.mjs'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const { OneBotBot } = createRequire(import.meta.url)('koishi-plugin-adapter-onebot') as typeof import('koishi-plugin-adapter-onebot')

function wav(rate = 24000, channels = 1) {
  const bytes = Buffer.alloc(44 + rate * channels * 2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * channels * 2, 28)
  bytes.writeUInt16LE(channels * 2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let i = 0; i < rate; i++) for (let channel = 0; channel < channels; channel++) bytes.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + (i * channels + channel) * 2)
  return bytes
}
const waitFor = async (check: () => boolean | Promise<boolean>) => {
  const deadline = Date.now() + 25000
  while (!await check()) { if (Date.now() > deadline) throw new Error('M3 fixture timeout'); await new Promise(resolve => setTimeout(resolve, 50)) }
}

test('M3 build overlay is idempotent and fails on unknown upstream; upstream files stay untouched', () => {
  const source = readFileSync('upstream/hds-interlude/src/service.ts', 'utf8')
  const overlaid = withOneBotVoice(source)
  assert.equal(withOneBotVoice(overlaid), overlaid)
  assert.throws(() => withOneBotVoice(source.replace("'private-session-send'", "'changed-send'")), /unknown\/ambiguous anchor/)
  assert.equal(readFileSync('upstream/hds-interlude/src/service.ts', 'utf8'), source)
})

test('M3 real WASM encoder supports TTS WAV rates and stereo without subprocesses; SILK decodes to audible PCM', { timeout: 20000 }, async () => {
  for (const [rate, channels] of [[16000, 1], [24000, 1], [44100, 2], [48000, 1]]) {
    const silk = await wavToSilk(wav(rate, channels))
    assert.equal(isSilk(silk), true)
    assert.ok(getDuration(silk) >= 1000 && getDuration(silk) <= 1100)
    const pcm = await decode(silk, 24000)
    assert.ok(pcm.data.length >= 48000)
    assert.ok(pcm.data.some(byte => byte !== 0), 'Decoding must yield sound, not an empty/silent record')
  }
  for (const bytes of [Buffer.alloc(0), Buffer.from('corrupt'), wav().subarray(0, 60), Buffer.alloc(10 * 1024 * 1024 + 1)]) await assert.rejects(() => wavToSilk(bytes))
})

test('M3 optional synthesis/encoding/record failures preserve text receipts; failed text never synthesizes', { timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'm3-fallback-'))
  const id = 'a'.repeat(64), metadata = { audioId: id, duration: 1 }
  let mode = 'valid', requests = 0, records = 0, textDelivered = false
  const api = createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    assert.equal(textDelivered, true, 'Text must already be delivered before any TTS work')
    requests++; res.setHeader('Content-Type', 'application/json')
    if (mode === 'http') res.statusCode = 503
    res.end(JSON.stringify(mode === 'empty' ? {} : mode === 'invalid-id' ? { ...metadata, audioId: '../secret' } : metadata))
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const bridge: VoiceBridgeConfig = { directory, cardId: 'first', token: 'fixture', url: `http://127.0.0.1:${(api.address() as any).port}/synthesize` }
  const bot = { platform: 'onebot', sendMessage: async () => { records++; throw new Error('QQ record rejected') } }
  const sendText = async () => { textDelivered = true; return ['text-receipt'] }
  const deliver = () => oneBotVoiceDelivery(bridge, bot, 'private:12345', '今天真开心。', .95, '', sendText)
  try {
    for (const value of ['http', 'empty', 'invalid-id', 'missing', 'corrupt', 'symlink', 'valid']) {
      mode = value
      const file = join(directory, `${id}.wav`)
      rmSync(file, { force: true })
      if (value === 'corrupt') writeFileSync(file, 'bad WAV')
      if (value === 'symlink') { writeFileSync(join(directory, 'elsewhere.wav'), wav()); symlinkSync(join(directory, 'elsewhere.wav'), file) }
      if (value === 'valid') writeFileSync(file, wav())
      assert.deepEqual(await deliver(), ['text-receipt'])
    }
    assert.equal(records, 1, 'Only a valid, regular WAV reaches QQ; record rejection is optional')
    const before = requests
    await assert.rejects(() => oneBotVoiceDelivery(bridge, bot, 'private:12345', '正文', .95, '', async () => { throw new Error('text rejected') }), /text rejected/)
    assert.equal(requests, before)
    assert.deepEqual(await oneBotVoiceDelivery(bridge, { ...bot, platform: 'mobile-local' }, 'local', '正文', .95, '', sendText), ['text-receipt'])
    assert.equal(requests, before, 'Other platforms retain their existing path')
  } finally { await new Promise<void>(resolve => api.close(() => resolve())); rmSync(directory, { recursive: true, force: true }) }
})

test('M3 real HDS + OneBot private/group record delivery, final willingness, shared bridge gates and text fallback', { timeout: 90000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hds-m3-'))
  const voiceDir = join(directory, 'voice'); mkdirSync(voiceDir)
  const bytes = wav(), audioId = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(join(voiceDir, `${audioId}.wav`), bytes)
  let enabled = true, willingness: unknown = .95, bridgeMode = 'normal', rejectRecord = false, groupTurn = false
  let releaseSlow: (() => void) | undefined
  let replies = 0, lastVoice = -1000, used = 0, cooldown = 0, dailyLimit = 1000, receiptId = 70000
  const synthesis: any[] = [], models: any[] = [], delivered: any[] = []
  const settings = () => writeFileSync(join(voiceDir, 'settings.json'), JSON.stringify({ characters: { first: { enabled, threshold: .7 } }, cooldown, dailyLimit }))
  settings()
  // The Android side is a loopback fixture of the unchanged VoiceStore contract;
  // codec, HDS, SQLite, Koishi and the OneBot encoder/socket are real.
  const api = createServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += part
    const body = JSON.parse(raw); res.setHeader('Content-Type', 'application/json')
    if (req.url === '/synthesize') {
      assert.equal(req.headers.authorization, 'Bearer m3-private-bridge-token')
      synthesis.push(body); replies++
      if (bridgeMode === 'slow') await new Promise<void>(resolve => { releaseSlow = resolve })
      if (bridgeMode === 'http') { res.statusCode = 503; res.end('{}'); return }
      if (!enabled || body.willingness < .7 || body.willingness > 1 || replies - lastVoice < cooldown || used >= dailyLimit) { res.end('{}'); return }
      lastVoice = replies; used += 10
      res.end(JSON.stringify({ audioId, duration: 1 })); return
    }
    models.push(body)
    const decision = { script: '星禾拿起手机，开心地回复朋友。', ...(groupTurn
      ? { groupReply: { mode: 'immediate', content: '大家今天真开心。' }, interaction: { seen: true, reply: { mode: 'none' } } }
      : { interaction: { seen: true, reply: { mode: 'immediate', content: '今天真开心。' } } }), voice: { willingness } }
    if (body.stream) { res.setHeader('Content-Type', 'text/event-stream'); res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(decision) } }] })}\n\ndata: [DONE]\n\n`) }
    else res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] }))
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const apiPort = (api.address() as any).port
  const ws = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await new Promise<void>(resolve => ws.once('listening', resolve))
  let socket!: WebSocket
  ws.on('connection', client => {
    socket = client
    client.on('message', data => {
      const request = JSON.parse(data.toString()); let result: any = {}, rejected = false
      if (request.action === 'get_login_info') result = { user_id: 55555, nickname: '星禾' }
      if (request.action === 'get_guild_service_profile') result = { tiny_id: '0' }
      if (request.action === 'get_stranger_info') result = { user_id: request.params.user_id, nickname: '朋友' }
      if (request.action === 'get_group_info') result = { group_id: request.params.group_id, group_name: '朋友群' }
      if (['send_private_msg', 'send_group_msg'].includes(request.action)) {
        delivered.push(request); result = { message_id: ++receiptId }
        rejected = rejectRecord && request.params.message.some((segment: any) => segment.type === 'record')
      }
      client.send(JSON.stringify({ status: rejected ? 'failed' : 'ok', retcode: rejected ? 1200 : 0, data: result, echo: request.echo }))
    })
  })
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve))
  const port = (reserve.address() as any).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost({ card: parseJsonCard(JSON.stringify({ name: '星禾', personality: '开朗温柔' })), endpoint: `http://127.0.0.1:${apiPort}/v1/chat/completions`, model: 'm3-fixture', modelOptions: { mainStreamingMode: 'experimental' }, userName: '朋友', userProfile: '', autoAdvance: false,
      dataDir: directory, qqDir: join(directory, 'qq'), token: 'm3-host-token-at-least-32-characters', port,
      voiceBridge: { directory: voiceDir, cardId: 'first', token: 'm3-private-bridge-token', url: `http://127.0.0.1:${apiPort}/synthesize` } })
    Object.assign(host.qq!, { account: '55555', loginOnline: true })
    await host.dispatch('qq.policy', { enabled: true, users: ['12345'], groups: [{ ...newQQGroup(), groupId: '88888', cooldownSeconds: 0, debounceSeconds: 0 }] })
    const fork = host.app.plugin(OneBotBot, OneBotBot.Config({ selfId: '55555', protocol: 'ws', endpoint: `ws://127.0.0.1:${(ws.address() as any).port}`, responseTimeout: 2000 }))
    Object.assign(host.qq!, { fork })
    await waitFor(() => !!socket && host!.app.bots.some(bot => bot.platform === 'onebot' && bot.status === 1))
    let messageId = 1000
    const incoming = (group = false) => {
      groupTurn = group
      socket.send(JSON.stringify({ post_type: 'message', message_type: group ? 'group' : 'private', sub_type: group ? 'normal' : 'friend', self_id: 55555, user_id: 12345, ...(group ? { group_id: 88888 } : {}), message_id: ++messageId, time: Math.floor(Date.now() / 1000),
        message: [...(group ? [{ type: 'at', data: { qq: '55555' } }] : []), { type: 'text', data: { text: `今天开心吗？${messageId}` } }], sender: { user_id: 12345, nickname: '朋友', role: 'member' } }))
    }
    const records = () => delivered.filter(row => row.params.message.some((segment: any) => segment.type === 'record'))
    const texts = () => delivered.filter(row => row.params.message.some((segment: any) => segment.type === 'text'))
    const settled = async () => {
      const service = host!.app.interlude as any
      await waitFor(() => [...(service.mobileNarrativeTasks ?? [])].length === 0 && service.turnEngine.narrating.size === 0)
      await host!.drainVoice()
    }
    for (const group of [false, true]) {
      const before = records().length
      incoming(group); await waitFor(() => records().length === before + 1); await settled()
      const row = records().at(-1), segment = row.params.message[0]
      assert.equal(row.action, group ? 'send_group_msg' : 'send_private_msg')
      assert.equal(String(group ? row.params.group_id : row.params.user_id), group ? '88888' : '12345')
      assert.match(segment.data.file, /^base64:\/\//)
      const silk = Buffer.from(segment.data.file.slice(9), 'base64')
      assert.equal(isSilk(silk), true); assert.ok((await decode(silk, 24000)).data.length > 0)
      assert.equal(synthesis.at(-1).willingness, .95); assert.match(synthesis.at(-1).style, /开朗温柔/)
      assert.match(models.at(-1).messages[0].content, /CURRENT LOCAL VOICE OPTION/)
      assert.notEqual(models.at(-1).stream, true, 'Voice waits for final model decision in QQ too')
      assert.equal(JSON.stringify(models).includes('m3-private-bridge-token'), false)
      assert.equal(texts().length, before + 1, 'One text plus one record for each reply')
    }
    // The background/private-bot path must settle text while Android is still
    // synthesizing, so pending-delivery recovery cannot mistake audio for text.
    bridgeMode = 'slow'
    const participant = (await host.app.database.get('interlude_participant', { platform: 'onebot', userId: '12345' }))[0]
    const story = (await host.app.database.get('interlude_story', {}))[0]
    let textSettled = false
    const beforeSlow = texts().length, beforeSlowRecords = records().length
    const sending = (host.app.interlude as any).sendOutgoingMessages(story, [{ participantId: participant.id, content: '慢速语音仍先确认文字。', voice: { willingness: .95 } }]).then((rows: any[]) => { assert.equal(rows.length, 1); textSettled = true })
    await waitFor(() => !!releaseSlow && textSettled)
    assert.equal(texts().length, beforeSlow + 1)
    assert.equal(records().length, beforeSlowRecords, 'TTS is blocked, but the text receipt already returned')
    releaseSlow!(); releaseSlow = undefined
    await sending; await host.drainVoice(); bridgeMode = 'normal'
    assert.equal(records().length, beforeSlowRecords + 1)
    for (const failure of ['low', 'invalid', 'cooldown', 'daily', 'http', 'corrupt', 'reject', 'disabled']) {
      const before = texts().length, beforeRecords = records().length
      willingness = failure === 'low' ? .1 : failure === 'invalid' ? 2 : .95
      cooldown = failure === 'cooldown' ? 100 : 0; dailyLimit = failure === 'daily' ? used : 1000
      bridgeMode = failure === 'http' ? 'http' : 'normal'; rejectRecord = failure === 'reject'; enabled = failure !== 'disabled'; settings()
      writeFileSync(join(voiceDir, `${audioId}.wav`), failure === 'corrupt' ? Buffer.from('invalid') : bytes)
      incoming(); await waitFor(() => texts().length > before); await settled()
      assert.equal(texts().length, before + 1, `${failure}: Text delivers exactly once`)
      assert.equal(records().length, beforeRecords + (failure === 'reject' ? 1 : 0), `${failure}: No unusable voice sent`)
      if (failure === 'disabled') assert.doesNotMatch(models.at(-1).messages[0].content, /CURRENT LOCAL VOICE OPTION/)
    }
  } finally {
    releaseSlow?.()
    if (host) await host.stop()
    for (const client of ws.clients) client.terminate()
    await new Promise<void>(resolve => ws.close(() => resolve()))
    await new Promise<void>(resolve => api.close(() => resolve()))
    rmSync(directory, { recursive: true, force: true })
  }
})
