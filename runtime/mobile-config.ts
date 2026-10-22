import { Config } from '../upstream/hds-interlude/src/index'
import { Schema } from '@koishijs/core'
import { validateRetrievalEndpoint } from '../upstream/hds-interlude/src/model-routing'

// This is the supported surface, not a second copy of upstream defaults/types.
export const supportedFields: Record<string, string[]> = {
  runtime: ['minimumFollowUpCommitmentSeconds', 'sweepIntervalMinutes', 'autoAdvanceIntervalMinutes', 'autoAdvanceJitterMinutes', 'conversationFollowUpMinutes', 'conversationFollowUpJitterMinutes'],
  urge: ['enabled', 'frequency', 'proactiveWillingnessThreshold'],
  agency: ['enabled', 'contactMode', 'maxWindowMinutes', 'minimumProactiveIntervalMinutes', 'naturalWillingnessThreshold', 'naturalMinimumIntervalMinutes', 'proactiveDailyCap'],
  schedulePreplan: ['enabled', 'horizonDays', 'variationLevel', 'candidateActivationProbability', 'candidateRevealMinutes', 'reviewAfterLocalHour', 'anchorAutoAdvance'],
  timelineDirector: ['enabled'],
  chatActions: ['enabled', 'quoteReply', 'messageReactions', 'nativeFaces', 'allowedReactions', 'allowedNativeFaces', 'expressionThreshold'],
  alterSystem: ['enabled', 'baseThreshold', 'densityFactor', 'sameDirectionBoost', 'oppositeDecay', 'minWeight', 'maxIntensity', 'temperature', 'topP', 'maxTokens', 'timeout'],
  memory: ['enabled', 'backgroundIntervalMinutes', 'sceneEntryThreshold', 'sceneCharacterThreshold', 'recentEntryLimit', 'factLimit'],
  embedding: ['enabled', 'liveQuery', 'providerId', 'endpoint', 'model', 'dimensions', 'timeout'],
  rerank: ['enabled', 'providerId', 'endpoint', 'model', 'topN', 'scoreThreshold', 'timeout'],
  worldSeeder: ['enabled', 'cadenceMinutes', 'maxPending', 'dailyCap', 'maxHorizonHours', 'temperature', 'maxTokens', 'timeout'],
  longHorizon: ['enabled', 'triggerScore', 'reviewIncrement', 'intensity'],
  weather: ['enabled', 'latitude', 'longitude', 'autoFromLocation', 'skipFantasyWorld', 'cadenceMinutes'],
}
export type MobileConfig = { sections?: Record<string, Record<string, unknown>>; backgroundLimit?: number }
// rc56 exposes Embedding under model; providerId remains a supported legacy
// routing key in its defaults/types, but is absent from the visible schema.
function sectionSchema(key: string) {
  const root = Config as any
  if (key === 'memory') return { ...root.dict.memory, dict: { ...root.dict.memory.dict,
    recentEntryLimit: Schema.natural().min(1).max(20).default(20).description('每次主叙事附带的最近原始条目数；移动端最多 20 条。'),
    factLimit: Schema.natural().min(1).max(20).default(20).description('每次主叙事附带的长期事实数；移动端最多 20 条。') } }
  if (key === 'rerank') return root.dict.model.dict.rerank
  if (key !== 'embedding') return root.dict[key]
  const embedding = root.dict.model.dict.embedding
  return { meta: embedding.meta, dict: { ...embedding.dict,
    providerId: Schema.string().default(embedding.meta.default.providerId).description('向量模型连接编号；留空时使用模型分工中的向量连接。') } }
}
export function mobileSchema() {
  return { version: 1, backgroundLimit: 120, sections: Object.entries(supportedFields).map(([key, fields]) => {
    const section = sectionSchema(key)
    return { key, description: section.meta.description, fields: fields.map(name => {
      const field = section.dict[name]
      if (!field) throw new Error(`Unsupported upstream field ${key}.${name}`)
      return { key: name, type: field.type, default: field.meta.default ?? section.meta.default?.[name], description: field.meta.description,
        min: field.meta.min, max: field.meta.max, step: ['timeout', 'dimensions', 'topN'].includes(name) ? 1 : field.meta.step,
        maxLength: field.type === 'string' ? name === 'endpoint' ? 2048 : name === 'model' ? 256 : 64 : undefined, options: field.list?.map((item: any) => item.value),
        itemOptions: field.inner?.list?.map((item: any) => item.value),
        itemMin: field.inner?.meta?.min, itemMax: field.inner?.meta?.max }
    }) }
  }) }
}
export function normalizeMobileConfig(value: MobileConfig = {}): Required<MobileConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('生活设置格式无效')
  const backgroundLimit = value.backgroundLimit ?? 120
  if (value.sections !== undefined && (!value.sections || typeof value.sections !== 'object' || Array.isArray(value.sections))) throw new Error('生活设置分区无效')
  if (!Number.isInteger(backgroundLimit) || backgroundLimit < 0 || backgroundLimit > 10000) throw new Error('后台预算应为 0 至 10000 的整数')
  const sections: Record<string, Record<string, unknown>> = {}
  for (const [section, fields] of Object.entries(value.sections ?? {})) {
    if (!supportedFields[section] || !fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(`不支持的配置分区：${section}`)
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(fields)) {
      if (!supportedFields[section].includes(key)) throw new Error(`不支持的配置字段：${section}.${key}`)
      if (key === 'conversationFollowUpMinutes' && (!Array.isArray(item) || item.length > 12)) throw new Error('补写时间点最多 12 个')
      let normalized = item
      if (['endpoint', 'model', 'providerId'].includes(key)) {
        const max = key === 'endpoint' ? 2048 : key === 'model' ? 256 : 64
        const label = key === 'endpoint' ? 'HTTP(S) 地址' : key === 'model' ? '模型名' : '连接编号'
        if (typeof item !== 'string') throw new Error(`${section}.${key} 应为${label}`)
        normalized = item.trim()
        if ((normalized as string).length > max || /[\u0000-\u001f\u007f]/.test(normalized as string)) throw new Error(`${section}.${key} 应为不超过 ${max} 字符的${label}`)
        if (key === 'providerId' && normalized && !/^[a-zA-Z0-9-]{1,64}$/.test(normalized as string)) throw new Error(`${section}.${key} 连接编号无效`)
        if (key === 'endpoint' && normalized) {
          try { validateRetrievalEndpoint(normalized as string) } catch { throw new Error(`${section}.${key} 应为 HTTP(S) 地址，不含凭据或片段`) }
        }
      }
      if (['timeout', 'dimensions', 'topN'].includes(key) && !Number.isInteger(item)) throw new Error(`${section}.${key} 应为整数`)
      output[key] = sectionSchema(section).dict[key](normalized)
    }
    sections[section] = output
  }
  return { sections, backgroundLimit }
}
export function mapMobileConfig(value: MobileConfig | undefined, autoAdvance: boolean) {
  const { sections: { embedding, rerank, ...sections } } = normalizeMobileConfig(value)
  const urge = Boolean(sections.urge?.enabled)
  return {
    ...sections,
    // Materialize supported rc56 defaults, including the mobile memory budget.
    ...Object.fromEntries(mobileSchema().sections.filter(section => ['schedulePreplan', 'timelineDirector', 'memory', 'worldSeeder', 'longHorizon', 'weather'].includes(section.key)).map(section => [section.key, {
      ...Object.fromEntries(section.fields.map(field => [field.key, field.default])), ...sections[section.key],
    }])),
    runtime: { ...sections.runtime, autoCreate: true, autoAdvanceEnabled: autoAdvance, allowProactiveMessages: autoAdvance,
      userMessageDebounceSeconds: 1, typingMaxDelaySeconds: 12,
      contextEntryLimit: 20, contextTimeWindowMinutes: 10,
      conversationFollowUpMinutes: !autoAdvance || urge ? [] : sections.runtime?.conversationFollowUpMinutes ?? [10, 20] },
    urge: { ...sections.urge, enabled: autoAdvance && urge },
    agency: { ...sections.agency, enabled: autoAdvance && Boolean(sections.agency?.enabled) },
    alterSystem: { ...sections.alterSystem, maxTokens: sections.alterSystem?.maxTokens ?? 2000 },
    model: { rerank: { enabled: false, providerId: '', endpoint: '', model: '', topN: 20, scoreThreshold: 0, timeout: 5000, ...rerank }, embedding: { providerId: '', endpoint: '', model: '', dimensions: 0, timeout: 10000,
      maxInputCharacters: 4000, backfillBatchSize: 5, semanticHistory: false, semanticStickerFilter: true, ...embedding, enabled: embedding?.enabled === true, liveQuery: embedding?.liveQuery === true } },
    qzone: { enabled: false }, browser: { enabled: false }, presetSync: { enabled: false },
  }
}

/** Explicit providerId takes precedence over role flags; never use a chat model implicitly. */
export function embeddingProviders<T extends { id?: string; enabled?: boolean; protocol?: string; useForEmbedding?: boolean }>(providers: T[], options: Record<string, unknown> = {}) {
  const routed = providers.map(row => ({ ...row, useForEmbedding: row.enabled === true && row.protocol !== 'anthropic-messages' && row.protocol !== 'gemini-interactions'
    && (options.providerId ? row.id === options.providerId : row.useForEmbedding === true) }))
  if (options.enabled === true && !routed.some(row => row.useForEmbedding)) throw new Error('请在模型分工中指定启用的向量连接（OpenAI 兼容接口）')
  return routed
}

/** Reuse the App's visual route; never silently assign a text-only connection. */
export function stickerVisionProviders<T extends { id?: string; enabled?: boolean; useForMain?: boolean; imageInput?: string }>(providers: T[], options: { visionEnabled?: boolean; visionProviderId?: string }) {
  return providers.map(row => ({ ...row, useForStickers: options.visionEnabled === true && row.enabled === true && row.imageInput !== 'unsupported'
    && (options.visionProviderId ? row.id === options.visionProviderId : row.useForMain === true) }))
}
