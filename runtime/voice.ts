import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
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
export async function localVoiceDelivery(bridge: VoiceBridgeConfig | undefined, content: string, willingness: unknown, style: string): Promise<MessageAudio | undefined> {
  if (!bridge || !voiceText(content)) return undefined
  try {
    const url = new URL(bridge.url)
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.pathname !== '/synthesize') return undefined
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bridge.token}` },
      body: JSON.stringify({ text: voiceText(content), willingness: typeof willingness === 'number' && Number.isFinite(willingness) ? willingness : -1, style }) })
    if (!response.ok) return undefined
    return messageAudio(await response.json())
  } catch { return undefined }
}

/** Text is the authoritative delivery. Optional QQ audio cannot invalidate its
 * receipt, trigger a text retry, or bypass Android's shared quota/cooldown. */
export async function oneBotVoiceDelivery<T>(bridge: VoiceBridgeConfig | undefined, bot: { platform: string; sendMessage: (channelId: string, content: string) => Promise<unknown> }, channelId: string,
  content: string, willingness: unknown, style: string, sendText: () => Promise<T>): Promise<T> {
  const receipt = await sendText()
  if (bot?.platform !== 'onebot' || !bridge || (Array.isArray(receipt) && !receipt.length)) return receipt
  try {
    const audio = await localVoiceDelivery(bridge, content, willingness, style)
    if (!audio) return receipt
    const file = await open(join(bridge.directory, `${audio.audioId}.wav`), constants.O_RDONLY | constants.O_NOFOLLOW)
    let wav: Buffer
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024 || !stat.size) return receipt
      wav = await file.readFile()
    } finally { await file.close() }
    const silk = await wavToSilk(wav)
    // Koishi's real OneBot encoder emits a standalone record segment and turns
    // the data URI into base64://; no guest/Android filesystem path escapes.
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        bot.sendMessage(channelId, `<audio src="data:audio/silk;base64,${silk.toString('base64')}"/>`),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Optional voice delivery timed out')), 15000) }),
      ])
    } finally { clearTimeout(timer) }
  } catch { /* Synthesis, codec and optional record failures retain text. */ }
  return receipt
}
