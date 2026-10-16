import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
