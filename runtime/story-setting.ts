import { createHash } from 'node:crypto'
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export const settingRevision = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
export function settingPatch(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 120000) throw new Error('人设字段无效或过长')
  const allowed = ['character', 'user', 'world', 'relationship', 'perspective', 'perspectives', 'supplementaryFacts', 'supportingCast', 'location', 'style', 'timezone']
  const patch = value as Record<string, unknown>
  if (!Object.keys(patch).length || Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('包含不允许的人设字段')
  for (const [key, item] of Object.entries(patch)) {
    if (key === 'character' || key === 'user') {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.entries(item).some(([k, v]) => !(key === 'user' ? ['displayName', 'profile'] : ['name', 'profile']).includes(k) || typeof v !== 'string' || v.length > 20000)) throw new Error('角色或用户设定无效')
    } else if (key === 'supplementaryFacts' || key === 'perspectives') {
      if (!Array.isArray(item) || item.length > 100 || item.some(v => typeof v !== 'string' || v.length > 20000)) throw new Error('人设列表格式无效')
    } else if (typeof item !== 'string' || item.length > 20000) throw new Error('人设字段格式无效')
  }
  return patch
}
