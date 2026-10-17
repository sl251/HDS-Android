import { CapacitorHttp } from '@capacitor/core'
import schema from '../../packages/contracts/mobile-config.schema.json'
import type { MobileConfig } from '../../packages/contracts'
import type { PresetPreview } from './LifeSettings'
import { fetchShare, storyDefaultsToSettingPatch } from './share-sanitizer.js'

// Preview runs without the local host. Use the shipped schema; application still
// goes through inspectPreset in the host, including validation and fingerprint.
export async function inspectImportCode(code: string, current: MobileConfig, get = CapacitorHttp.get): Promise<PresetPreview> {
  const { info, removed } = await fetchShare({ http: { get: async (url: string) => {
    const response = await get({ url, connectTimeout: 15_000, readTimeout: 15_000, responseType: 'json' })
    if (response.status !== 200) throw { response: { status: response.status, json: async () => response.data } }
    return response.data
  } } }, 'https://typ0.space', code)
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([info.code, info.revision, info.payload])))), byte => byte.toString(16).padStart(2, '0')).join('')
  const { storyDefaults, ...sections } = info.payload
  const storyPatch = storyDefaults === undefined ? undefined : storyDefaultsToSettingPatch(storyDefaults)
  const config = structuredClone(current)
  config.backgroundLimit ??= schema.backgroundLimit
  config.sections ??= {}
  const changes: PresetPreview['changes'] = []
  for (const [section, fields] of Object.entries(sections)) {
    const supported = schema.sections.find(row => row.key === section)
    if (!supported || !fields || typeof fields !== 'object' || Array.isArray(fields)) { removed.push(section); continue }
    for (const [key, value] of Object.entries(fields)) {
      const field = supported.fields.find(row => row.key === key)
      if (!field) { removed.push(`${section}.${key}`); continue }
      const before = config.sections[section]?.[key]
      if (JSON.stringify(before) !== JSON.stringify(value)) changes.push({ section, field: key, before, after: value })
      config.sections[section] = { ...config.sections[section], [key]: value }
    }
  }
  if (!Object.keys(storyPatch ?? {}).length && !Object.entries(sections).some(([section, fields]) => fields && typeof fields === 'object' && !Array.isArray(fields) && Object.keys(fields).some(key => schema.sections.find(row => row.key === section)?.fields.some(field => field.key === key)))) throw new Error('此预设没有移动端支持的生活配置或角色人设字段')
  return { config, changes, removed, storyPatch, code: info.code, title: info.title, revision: info.revision, fingerprint }
}
