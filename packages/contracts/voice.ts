export type MessageAudio = { audioId: string; duration: number }
export type Voice = { id: string; name: string; type: 'builtin' | 'design' | 'reference'; value: string }
export type VoiceBinding = { enabled: boolean; voiceId: string; threshold: number }
export type VoiceState = { voices: Voice[]; defaultVoiceId: string; characters: Record<string, VoiceBinding>; dailyLimit: number; cooldown: number; usedTokens: number; credentialPresent: boolean; notice?: string }
export const emptyVoiceState = (): VoiceState => ({ voices: [], defaultVoiceId: 'builtin', characters: {}, dailyLimit: 50000, cooldown: 5, usedTokens: 0, credentialPresent: false })
export function messageAudio(value: unknown): MessageAudio | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { audioId, duration } = value as Partial<MessageAudio>
  return typeof audioId === 'string' && /^[a-f0-9]{64}$/.test(audioId) && typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 180 ? { audioId, duration } : undefined
}
export const stripMediaMarkers = (text: string) => text.replace(/(?:\[|【)\s*(?:表情包?|贴纸|贴图|图片|图像|动图|gif|sticker|image|media|localMedia|语音|音频|voice|audio)(?:\s*[:：][^\]】\n]*|\s+[^\]】\n]*)?\s*(?:\]|】)/gi, '')
/** TTS reads exactly the visible final transcript, never model reasoning or transport markup. */
export function voiceText(content: string) {
  return stripMediaMarkers(content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').replace(/<[^>]*>/g, '')).trim()
}
