import { createHash } from 'node:crypto'
import { fetchShare, sanitizeSharePayload, storyDefaultsToSettingPatch } from '../upstream/hds-interlude/src/share-sync'
import { normalizeMobileConfig, supportedFields, type MobileConfig } from './mobile-config'
import type { Context } from 'koishi'

export function mobilePreset(raw: unknown, current: MobileConfig) {
  const { preset, removed } = sanitizeSharePayload(raw)
  const { storyDefaults, ...sections } = preset
  const storyPatch = storyDefaults === undefined ? undefined : storyDefaultsToSettingPatch(storyDefaults)
  const next = normalizeMobileConfig(current)
  const changes: { section: string; field: string; before: unknown; after: unknown }[] = []
  for (const [section, fields] of Object.entries(sections)) {
    if (!supportedFields[section] || !fields || typeof fields !== 'object' || Array.isArray(fields)) { removed.push(section); continue }
    for (const [key, value] of Object.entries(fields)) {
      if (!supportedFields[section].includes(key)) { removed.push(`${section}.${key}`); continue }
      const before = next.sections[section]?.[key]
      if (JSON.stringify(before) !== JSON.stringify(value)) changes.push({ section, field: key, before, after: value })
      next.sections[section] = { ...next.sections[section], [key]: value }
    }
  }
  if (!Object.keys(storyPatch ?? {}).length && !Object.keys(sections).some(section => Object.keys((sections[section] ?? {}) as object).some(key => supportedFields[section]?.includes(key)))) throw new Error('此预设没有移动端支持的生活配置或角色人设字段')
  return { config: normalizeMobileConfig(next), changes, removed, storyPatch }
}
export async function inspectPreset(ctx: Context, code: string, current: MobileConfig, expected?: string) {
  const { info, removed } = await fetchShare(ctx, 'https://typ0.space', code)
  const fingerprint = createHash('sha256').update(JSON.stringify([info.code, info.revision, info.payload])).digest('hex')
  if (expected && fingerprint !== expected) throw new Error('预设版本已变化，请重新检查差异')
  const preview = mobilePreset(info.payload, current)
  return { ...preview, removed: [...removed, ...preview.removed],
    code: info.code, title: info.title, revision: info.revision, fingerprint }
}
