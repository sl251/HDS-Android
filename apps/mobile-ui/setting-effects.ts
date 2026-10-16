export type SettingEffect = 'render' | 'llm' | 'schedule'
type SettingTiming = 'immediate' | 'nextReply' | 'restart'

export const settingEffectLabels = {
  immediate: '改动立即生效',
  nextReply: '下次回复生效',
  restart: '重启核心后生效',
} as const satisfies Record<SettingTiming, string>

// Describe the existing save/load behavior; this table does not apply settings.
export const settingEffects = {
  appearance: { affects: 'render', timing: 'immediate' },
  notifications: { affects: 'render', timing: 'immediate' },
  life: { affects: 'schedule', timing: 'restart' },
  models: { affects: 'llm', timing: 'restart' },
  identity: { affects: 'llm', timing: 'restart' },
  memory: { affects: 'llm', timing: 'nextReply' },
} as const satisfies Record<string, { affects: SettingEffect; timing: SettingTiming }>
