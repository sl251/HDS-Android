import type { ModelProvider, ModelSettings } from '../../packages/contracts'

export type ModelTask = 'useForMain' | 'useForCompaction' | 'useForAlter' | 'useForEmbedding' | 'useForWorldSeeding'
export const assigned = (rows: ModelProvider[], task: ModelTask) => rows.filter(row => row.enabled && row[task]).map(row => row.id)
export function followsMain(rows: ModelProvider[], task: ModelTask) {
  return JSON.stringify(assigned(rows, task)) === JSON.stringify(assigned(rows, 'useForMain'))
}
export function assignTask(rows: ModelProvider[], task: ModelTask, id: string): ModelProvider[] {
  const inherited = (['useForCompaction', 'useForAlter'] as const).filter(key => followsMain(rows, key))
  const targets = id === 'inherit' ? assigned(rows, 'useForMain') : [id]
  return rows.map(row => ({ ...row, [task]: targets.includes(row.id),
    ...(task === 'useForMain' ? Object.fromEntries(inherited.map(key => [key, row.id === id])) : {}) }))
}
export function removeProvider(rows: ModelProvider[], id: string): ModelProvider[] {
  let next = rows.filter(row => row.id !== id)
  const fallback = next.find(row => row.enabled)
  if (!fallback) return next
  for (const task of ['useForMain', 'useForCompaction', 'useForAlter'] as const) {
    if (!assigned(next, task).length) next = assignTask(next, task, task === 'useForMain' ? fallback.id : 'inherit')
  }
  return next
}

/** Read legacy flags without rewriting a working explicit retrieval route on load. */
export function embeddingProviderId(settings: ModelSettings): string {
  return String(settings.mobileConfig?.sections?.embedding?.providerId || settings.providers.find(row => row.enabled && row.protocol === 'chat-completions' && row.useForEmbedding)?.id || '')
}

/** The task selector is the only place that changes embedding ownership. */
export function assignEmbedding(settings: ModelSettings, id: string): ModelSettings {
  return { ...settings, providers: assignTask(settings.providers, 'useForEmbedding', id),
    mobileConfig: { ...settings.mobileConfig, sections: { ...settings.mobileConfig?.sections,
      embedding: { ...settings.mobileConfig?.sections?.embedding, providerId: id } } } }
}

export function toggleTaskProvider(settings: ModelSettings, task: ModelTask, id: string, enabled: boolean): ModelSettings {
  const inherited = (['useForCompaction', 'useForAlter'] as const).filter(key => followsMain(settings.providers, key))
  const providers = settings.providers.map(row => row.id === id ? { ...row, [task]: enabled,
    ...(task === 'useForMain' ? Object.fromEntries(inherited.map(key => [key, enabled])) : {}) } : row)
  const enableFailover = task === 'useForMain' && enabled && assigned(settings.providers, task).length === 1 && assigned(providers, task).length === 2
  return { ...settings, providers, modelOptions: { ...settings.modelOptions, ...(enableFailover ? { failoverEnabled: true } : {}) } }
}
