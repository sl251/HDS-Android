import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { open, lstat } from 'node:fs/promises'
import { wavToSilk } from './voice-codec'
import { voiceText, messageAudio, type MessageAudio } from '../packages/contracts/voice'

export type VoiceBridgeConfig = { url: string; token: string; cardId: string; directory: string }
/** Config contains no credentials; missing/old settings never grant a capability. */
export function localVoiceCapability(bridge?: VoiceBridgeConfig) {
  if (!bridge) return undefined
  try {
    const settings = JSON.parse(readFileSync(join(bridge.directory, 'settings.json'), 'utf8'))
    const binding = settings.characters?.[bridge.cardId]
    if (binding?.enabled !== true) return undefined
    return { enabled: true, threshold: typeof binding.threshold === 'number' && Number.isFinite(binding.threshold) ? Math.max(0, Math.min(1, binding.threshold)) : .7 }
  } catch { return undefined }
}
type VoiceOutcome = { requestId: string; status: 'skipped' | 'failed' | 'generated'; stage: string; reason?: string; elapsedMs?: number }
export async function localVoiceDelivery(bridge: VoiceBridgeConfig | undefined, content: string, willingness: unknown, style: string, requestId = randomUUID(), report: (value: VoiceOutcome) => void = () => {}): Promise<MessageAudio | undefined> {
  const started = Date.now(), sink = report
  report = value => sink({ ...value, elapsedMs: Date.now() - started })
  if (!bridge || !voiceText(content)) { report({ requestId, status: 'skipped', stage: 'bridge', reason: !bridge ? 'no_bridge' : 'no_text' }); return undefined }
  try {
    const url = new URL(bridge.url)
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.pathname !== '/synthesize') { report({ requestId, status: 'failed', stage: 'bridge', reason: 'invalid_bridge' }); return undefined }
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(105000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bridge.token}` },
      body: JSON.stringify({ text: voiceText(content), willingness: typeof willingness === 'number' && Number.isFinite(willingness) ? willingness : -1, style }) })
    if (!response.ok) { report({ requestId, status: 'failed', stage: 'bridge', reason: 'bridge_rejected' }); return undefined }
    const result = await response.json() as { diagnostic?: { status?: string; reason?: string } }
    const audio = messageAudio(result)
    const reason = result?.diagnostic?.reason
    report({ requestId, status: audio ? 'generated' : result?.diagnostic?.status === 'skipped' ? 'skipped' : 'failed', stage: 'synthesis',
      reason: typeof reason === 'string' && /^[a-z_0-9]{1,80}$/.test(reason) ? reason : audio ? undefined : 'provider_missing_audio' })
    return audio
  } catch { report({ requestId, status: 'failed', stage: 'bridge', reason: 'provider_timeout_or_network' }); return undefined }
}

/** Choose one transport before sending. A confirmed record receipt is the reply
 * receipt; ambiguous sends must never be followed by a second text message. */
export async function oneBotVoiceDelivery<T>(bridge: VoiceBridgeConfig | undefined, bot: { platform: string; sendMessage: (channelId: string, content: string) => Promise<T> }, channelId: string,
  content: unknown, willingness: unknown, style: string, sendText: () => Promise<T>): Promise<T> {
  const markup = Array.isArray(content) ? content.map(String).join('') : String(content)
  if (bot?.platform !== 'onebot' || !bridge || /<(?:img|image|audio|video|face)\b/i.test(markup)) return sendText()
  let silk: Buffer
  try {
    const audio = await localVoiceDelivery(bridge, markup, willingness, style)
    if (!audio) return sendText()
    const path = join(bridge.directory, `${audio.audioId}.wav`)
    if (!(await lstat(path)).isFile()) return sendText()
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    let wav: Buffer
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024 || !stat.size) return sendText()
      wav = await file.readFile()
    } finally { await file.close() }
    silk = await wavToSilk(wav)
  } catch { return sendText() } // Nothing has been sent: safe text fallback.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const receipt = await Promise.race([
      bot.sendMessage(channelId, `<audio src="data:audio/silk;base64,${silk.toString('base64')}"/>`),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('record receipt timed out')), 15000) }),
    ])
    const ids = Array.isArray(receipt) ? receipt : [receipt]
    if (!ids.length || !ids.every(id => typeof id === 'string' ? !!id.trim() : typeof id === 'number' && Number.isFinite(id))) throw new Error('record receipt missing')
    return receipt
  } catch (error) {
    // OneBot SenderError carries an explicit nonzero retcode. A network error,
    // empty receipt or timeout cannot establish that the record was rejected.
    const code = (error as { code?: unknown })?.code
    if (typeof code === 'number' && code !== 0) return sendText()
    throw Object.assign(new Error('transport-timeout:voice-send (语音结果未知，未追加文字)'), { transportTimeout: true })
  } finally { clearTimeout(timer) }
}
