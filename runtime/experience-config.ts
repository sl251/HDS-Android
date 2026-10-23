import { defaultExperience, type ExperienceSettings, type MediaConnection } from '../packages/contracts/experience'

export function normalizeExperience(value: Partial<ExperienceSettings> = {}): ExperienceSettings {
  const defaults = defaultExperience()
  const connection = (input: Partial<MediaConnection> = {}, image = false): MediaConnection => {
    const provider = image && input.provider === 'imagefree' ? 'imagefree' : 'compatible'
    const endpoint = provider === 'imagefree' ? 'https://imagefree.net' : String(input.endpoint ?? '').trim()
    if (endpoint) { const url = new URL(endpoint); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('媒体服务地址无效') }
    const model = String(input.model ?? '').trim()
    if (endpoint.length > 2048 || model.length > 256 || String(input.apiKey ?? '').length > 8192) throw new Error('媒体服务配置过长')
    if (input.enabled && (!endpoint || provider === 'compatible' && !model)) throw new Error('请填写媒体服务地址和模型')
    return { enabled: input.enabled === true, provider, endpoint, model, apiKey: input.apiKey ?? '', referenceImages: provider === 'compatible' && input.referenceImages === true }
  }
  const visual = { ...defaults.visual, ...value.visual }
  for (const field of ['appearance', 'style', 'outfit', 'constraints'] as const) {
    if (typeof visual[field] !== 'string' || visual[field].length > 3000) throw new Error('视觉档案字段过长')
  }
  if (!['1:1', '3:4', '4:3', '9:16', '16:9'].includes(visual.ratio) || !Number.isFinite(visual.cooldownMinutes) || visual.cooldownMinutes < 0 || visual.cooldownMinutes > 1440) throw new Error('生图比例或冷却设置无效')
  if (!Array.isArray(visual.references) || visual.references.length > 3 || !visual.references.every(id => /^[a-f0-9]{64}$/.test(id))) throw new Error('参考图无效')
  return { enterBehavior: value.enterBehavior === 'send' ? 'send' : 'newline', stt: connection(value.stt), image: connection(value.image, true), visual, feedEnabled: value.feedEnabled !== false }
}
export function imagePrompt(config: ExperienceSettings, scene: string) {
  const v = config.visual
  return [`角色固定外观（保持身份与面部特征一致，优先于场景中的冲突描述）：${v.appearance || '以场景描述为准'}`, v.outfit && `常用衣装（场景明确指定时可换装）：${v.outfit}`, `本次场景：${scene}`, `画风：${v.style}`, v.constraints && `画面约束：${v.constraints}`].filter(Boolean).join('\n')
}
