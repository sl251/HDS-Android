import { Config } from '../upstream/hds-interlude/src/index'

// This is the supported surface, not a second copy of upstream defaults/types.
export const supportedFields: Record<string, string[]> = {
  runtime: ['minimumFollowUpCommitmentSeconds', 'sweepIntervalMinutes', 'autoAdvanceIntervalMinutes', 'autoAdvanceJitterMinutes', 'conversationFollowUpMinutes', 'conversationFollowUpJitterMinutes'],
  urge: ['enabled', 'frequency', 'proactiveWillingnessThreshold'],
  agency: ['enabled', 'contactMode', 'maxWindowMinutes', 'minimumProactiveIntervalMinutes', 'naturalWillingnessThreshold', 'naturalMinimumIntervalMinutes', 'proactiveDailyCap'],
  schedulePreplan: ['enabled', 'horizonDays', 'variationLevel', 'candidateActivationProbability', 'candidateRevealMinutes', 'reviewAfterLocalHour', 'anchorAutoAdvance'],
  timelineDirector: ['enabled'],
  chatActions: ['enabled', 'quoteReply', 'expressionThreshold'],
  alterSystem: ['enabled', 'baseThreshold', 'densityFactor', 'sameDirectionBoost', 'oppositeDecay', 'minWeight', 'maxIntensity', 'temperature', 'topP', 'maxTokens', 'timeout'],
  memory: ['enabled', 'backgroundIntervalMinutes', 'sceneEntryThreshold', 'sceneCharacterThreshold', 'recentEntryLimit', 'factLimit'],
}
export type MobileConfig = { sections?: Record<string, Record<string, unknown>>; backgroundLimit?: number }
export function mobileSchema() {
  const root = Config as any
  return { version: 1, backgroundLimit: 120, sections: Object.entries(supportedFields).map(([key, fields]) => {
    const section = root.dict[key]
    return { key, description: section.meta.description, fields: fields.map(name => {
      const field = section.dict[name]
      if (!field) throw new Error(`Unsupported upstream field ${key}.${name}`)
      return { key: name, type: field.type, default: field.meta.default ?? section.meta.default?.[name], description: field.meta.description,
        min: field.meta.min, max: field.meta.max, step: field.meta.step, options: field.list?.map((item: any) => item.value),
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
      output[key] = (Config as any).dict[section].dict[key](item)
    }
    sections[section] = output
  }
  return { sections, backgroundLimit }
}
export function mapMobileConfig(value: MobileConfig | undefined, autoAdvance: boolean) {
  const { sections } = normalizeMobileConfig(value)
  const urge = Boolean(sections.urge?.enabled)
  return {
    ...sections,
    runtime: { ...sections.runtime, autoCreate: true, autoAdvanceEnabled: autoAdvance, allowProactiveMessages: autoAdvance,
      userMessageDebounceSeconds: 1, typingMaxDelaySeconds: 12,
      conversationFollowUpMinutes: !autoAdvance || urge ? [] : sections.runtime?.conversationFollowUpMinutes ?? [10, 20] },
    urge: { ...sections.urge, enabled: autoAdvance && urge },
    agency: { ...sections.agency, enabled: autoAdvance && Boolean(sections.agency?.enabled) },
    timelineDirector: { ...sections.timelineDirector, enabled: autoAdvance && sections.timelineDirector?.enabled !== false },
    chatActions: { ...sections.chatActions, messageReactions: false, nativeFaces: false },
    qzone: { enabled: false }, browser: { enabled: false }, presetSync: { enabled: false },
  }
}
