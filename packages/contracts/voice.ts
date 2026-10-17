export type MessageAudio = { audioId: string; duration: number }
export type Voice = { id: string; name: string; type: 'builtin' | 'design' | 'reference'; value: string; verified?: boolean }
export type VoiceBinding = { enabled: boolean; voiceId: string; threshold: number }
export type VoiceResult = { status?: string; stage?: string; reason?: string; requestId?: string }
export type VoiceState = { voices: Voice[]; defaultVoiceId: string; characters: Record<string, VoiceBinding>; dailyLimit: number; cooldown: number; usedTokens: number; confirmedTokens?: number; reservedTokens?: number; unknownTokens?: number; lastResult?: VoiceResult; credentialPresent: boolean; notice?: string }
export function voiceResultLabel(result?: VoiceResult) {
  const reasons: Record<string, string> = { disabled: '角色语音已关闭', threshold: '角色本轮选择文字表达', cooldown: '语音冷却中', quota: '今日语音额度不足', missing_key: '请保存语音密钥', queue_full: '语音任务繁忙，本轮保留文字', provider_http_400: '音色参数被服务拒绝', provider_http_401: '语音密钥无效', provider_http_403: '语音服务无权限', provider_http_429: '语音服务限流或额度不足', provider_missing_audio: '服务未返回音频', provider_invalid_audio: '服务返回的音频无法播放', provider_timeout_or_network: '请求中断或超时，用量待确认', in_progress_or_interrupted: '语音仍在处理或已中断', transport_failed: 'QQ 语音发送失败或回执未知', codec_failed: 'QQ 语音转换失败', decode_failed: '音频读取失败' }
  return result?.reason ? reasons[result.reason] || `语音处理未完成（${result.stage || '合成'}）` : result?.status === 'generated' ? '远端合成成功' : result?.status === 'sent' ? 'QQ 语音已确认发送' : ''
}
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
