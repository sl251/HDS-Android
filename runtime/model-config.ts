import type { ModelOptions, ModelProvider } from '../packages/contracts'
import { stickerVisionProviders } from './mobile-config'
import type { ModelConfig, ProviderConfig } from '../upstream/hds-interlude/src/narrator'

type Input = { providers?: (ModelProvider & { mode?: ProviderConfig['mode'] })[]; modelOptions?: Partial<ModelOptions>; endpoint: string; model: string; apiKey?: string }
export function mobileModelConfig(input: Input): Partial<ModelConfig> & { providers: ProviderConfig[] } {
  const rows = input.providers ?? [{ id: 'legacy-primary', label: '原有模型连接', endpoint: input.endpoint, model: input.model, apiKey: input.apiKey ?? '', enabled: true, useForMain: true, useForCompaction: true, useForAlter: true }]
  if (!rows.length || rows.length > 12) throw new Error('Expected 1–12 model connections')
  const providers = rows.map(row => {
    if (!['unknown', 'supported', 'unsupported'].includes(row.imageInput ?? 'unknown')) throw new Error('图片能力声明无效')
    const url = new URL(row.endpoint)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !row.model) throw new Error('Invalid model connection')
    return { temperature: 0.8, topP: 1, maxTokens: 4096, timeout: 60000, responseFormat: 'json-object', extraHeaders: '', extraBody: '', mode: 'openai-compatible', protocol: 'chat-completions', ...row } as ProviderConfig
  })
  for (const role of ['useForMain', 'useForCompaction', 'useForAlter'] as const) {
    if (!providers.some(row => row.enabled && row[role])) throw new Error(`No enabled connection assigned to ${role}`)
  }
  const options = input.modelOptions ?? {}
  if (options.mainStreamingMode === 'experimental' && options.mainResponseFormat === 'prompt-only') throw new Error('Streaming requires JSON mode')
  const visionId = options.visionProviderId || ''
  if (options.visionEnabled && visionId && !providers.some(row => row.id === visionId && row.enabled)) throw new Error('识图连接已移除或停用，请重新选择')
  return {
    providers: stickerVisionProviders(providers.map(row => ({ ...row, useForVision: !!visionId && row.id === visionId })), options),
    vision: { enabled: options.visionEnabled === true, mode: visionId ? 'sidecar' : 'native', detail: 'auto', maxImageDimension: 1024 },
    mainTemperature: options.mainTemperature ?? 0.8,
    mainMaxTokens: options.mainMaxTokens ?? 4096,
    mainTimeout: options.mainTimeout ?? 60000,
    mainStreamingMode: options.mainStreamingMode ?? 'off',
    mainResponseFormat: options.mainResponseFormat ?? 'json-object',
    mainPayloadOrder: options.mainPayloadOrder ?? 'cache-first',
    failover: { enabled: options.failoverEnabled ?? false, strategy: options.failoverStrategy ?? 'priority', maxAttemptsPerProvider: 1, cooldownMinutes: 5 },
  }
}
