import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { open, lstat, realpath } from 'node:fs/promises'
import { wavToSilk } from './voice-codec'
import { randomUUID } from 'node:crypto'
import { voiceText, messageAudio, type MessageAudio } from '../packages/contracts/voice'

export type VoiceBridgeConfig = { url: string; token: string; cardId: string; directory: string }
export type VoiceOutcome = { requestId: string; status: 'skipped' | 'failed' | 'unknown' | 'sent' | 'generated'; stage: string; reason?: string; elapsedMs?: number; targetType?: 'private' | 'group'; messageId?: unknown; action?: string; retcode?: number; duration?: number }
export const voiceOutcomes: VoiceOutcome[] = []
export function recordVoiceOutcome(result: VoiceOutcome) { voiceOutcomes.push(result); if (voiceOutcomes.length > 50) voiceOutcomes.shift() }
export type MobileVoiceDelivery = <T>(bot: { platform: string; sendMessage: (channelId: string, content: string) => Promise<unknown> }, channelId: string, spokenText: string, willingness: unknown, sendText: () => Promise<T>) => Promise<T>
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
export async function localVoiceDelivery(bridge: VoiceBridgeConfig | undefined, content: string, willingness: unknown, style: string, requestId = randomUUID(), report = recordVoiceOutcome): Promise<MessageAudio | undefined> {
  if (!bridge || !voiceText(content)) return undefined
  try {
    const url = new URL(bridge.url)
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.pathname !== '/synthesize') return undefined
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bridge.token}` },
      body: JSON.stringify({ requestId, text: voiceText(content), willingness: typeof willingness === 'number' && Number.isFinite(willingness) ? willingness : -1, style }) })
    if (!response.ok) { report({ requestId, status: 'failed', stage: 'bridge', reason: `http_${response.status}` }); return undefined }
    const data = await response.json() as Record<string, unknown>
    const audio = messageAudio(data)
    report({ requestId, status: audio ? 'generated' : data.status === 'skipped' ? 'skipped' : data.status === 'unknown' ? 'unknown' : 'failed', stage: 'synthesis', reason: typeof data.reason === 'string' && /^[a-zA-Z0-9_:-]{1,80}$/.test(data.reason) ? data.reason : audio ? undefined : 'no_audio' })
    return audio
  } catch { report({ requestId, status: 'unknown', stage: 'bridge', reason: 'timeout_or_network' }); return undefined }
}

/** Text is the authoritative delivery. Optional QQ audio cannot invalidate its
 * receipt, trigger a text retry, or bypass Android's shared quota/cooldown. */
export async function oneBotVoiceDelivery<T>(bridge: VoiceBridgeConfig | undefined, bot: { platform: string; sendMessage: (channelId: string, content: string) => Promise<unknown> }, channelId: string,
  spokenText: string, willingness: unknown, style: string, sendText: () => Promise<T>, report = recordVoiceOutcome, cancelled = () => false): Promise<T> {
  const receipt = await sendText()
  if (bot?.platform !== 'onebot' || !bridge || (Array.isArray(receipt) && !receipt.length)) return receipt
  const requestId = randomUUID(), started = Date.now()
  const targetType = channelId.startsWith('private:') ? 'private' : 'group'
  const action = targetType === 'private' ? 'send_private_msg' : 'send_group_msg'
  let stage = 'synthesis'
  let duration: number | undefined
  const emit = (outcome: VoiceOutcome) => report({ ...outcome, action, duration, targetType, elapsedMs: Date.now() - started })
  try {
    const audio = await localVoiceDelivery(bridge, spokenText, willingness, style, requestId, emit)
    if (!audio) return receipt
    duration = audio.duration
    if (cancelled()) { emit({ requestId, status: 'skipped', stage: 'queue', reason: 'stopping' }); return receipt }
    stage = 'decode'
    const path = join(bridge.directory, `${audio.audioId}.wav`)
    if ((await lstat(path)).isSymbolicLink() || await realpath(path) !== join(await realpath(bridge.directory), `${audio.audioId}.wav`)) throw new Error('invalid_audio_path')
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    let wav: Buffer
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024 || !stat.size) throw new Error('invalid_audio_file')
      wav = await file.readFile()
    } finally { await file.close() }
    stage = 'codec'
    const silk = await wavToSilk(wav)
    if (cancelled()) { emit({ requestId, status: 'skipped', stage: 'queue', reason: 'stopping' }); return receipt }
    // Koishi's real OneBot encoder emits a standalone record segment and turns
    // the data URI into base64://; no guest/Android filesystem path escapes.
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      stage = 'transport'
      const messageId = await Promise.race([
        bot.sendMessage(channelId, `<audio src="data:audio/silk;base64,${silk.toString('base64')}"/>`),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Optional voice delivery timed out')), 15000) }),
      ])
      if (!Array.isArray(messageId) || !messageId.length) throw new Error('missing_receipt')
      emit({ requestId, status: 'sent', stage, messageId, retcode: 0 })
    } finally { clearTimeout(timer) }
  } catch (error) { const retcode = (error as { retcode?: unknown })?.retcode; emit({ requestId, status: stage === 'transport' && /timeout|timed out/i.test(error instanceof Error ? error.message : '') ? 'unknown' : 'failed', stage, reason: `${stage}_failed`, ...(typeof retcode === 'number' && Number.isFinite(retcode) ? { retcode } : {}) }) }
  return receipt
}
