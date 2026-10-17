import { stringify } from 'yaml'
import { sanitizeSharePayload } from './share-sanitizer.js'

export type ExportFormat = 'tavern' | 'preset' | 'yaml'
export type CharacterExport = { filename: string; mime: string; content: string }
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (...values: unknown[]) => values.find(value => typeof value === 'string' && value.trim()) as string | undefined ?? ''
// Extra privacy boundary beyond upstream's connection scrub: account/contact keys,
// connection aliases and recognizable credentials/contacts embedded in prose.
const privateField = /api.?key|endpoint|token$|secret|password|authorization|headers|proxy|base.?url|phone|mobile|^qq|^(tel|uin|account|userId|groupId|personId|手机号)$/i
function privateScrub(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\b1[3-9]\d{9}\b/g, '[手机号已移除]').replace(/((?:QQ|扣扣)\s*(?:号|号码)?\s*[:：=]?\s*)[1-9]\d{4,11}/gi, '$1[已移除]').replace(/\b(?:sk-|Bearer\s+)[A-Za-z0-9_./+\-=]{8,}/gi, '[凭据已移除]')
  if (Array.isArray(value)) return value.map(privateScrub)
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !privateField.test(key)).map(([key, item]) => [key, privateScrub(item)]))
  return value
}
function settingRecord(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('当前故事没有可导出的人设，请先选择角色并唤醒故事。')
  const setting = record(privateScrub(sanitizeSharePayload({ storyDefaults: value }).preset.storyDefaults))
  const character = record(setting.character)
  const name = text(character.name, setting.characterName, setting.name)
  if (!name) throw new Error('当前故事缺少角色名，无法导出。')
  return { setting, character, name, description: text(character.profile, character.description, character.persona, setting.characterProfile, setting.description, setting.persona) }
}
export function buildPresetPayload(value: unknown, config: unknown = {}): Record<string, unknown> {
  const { setting, name, description } = settingRecord(value)
  const { character, user, ...rest } = setting
  const storyDefaults = { ...rest, characterName: name, characterProfile: description, userProfile: text(record(user).profile, setting.userProfile) }
  // Mobile settings wrap upstream sections; typ0 expects sections at the root.
  return privateScrub(sanitizeSharePayload({ ...record(record(config).sections), storyDefaults }).preset) as Record<string, unknown>
}
function characterBook(setting: Record<string, unknown>) {
  const source = setting.character_book ?? setting.worldbook ?? setting.worldBook ?? setting.lorebook ?? setting.lore
  const rows = Array.isArray(source) ? source : Array.isArray(record(source).entries) ? record(source).entries as unknown[] : typeof source === 'string' && source.trim() ? [source] : []
  const entries = rows.map((value, index) => {
    const row = record(value)
    const content = typeof value === 'string' ? value : text(row.content, row.text, row.description)
    const keys = Array.isArray(row.keys) ? row.keys.filter((key): key is string => typeof key === 'string') : typeof row.keys === 'string' ? [row.keys] : []
    return { id: index, keys, secondary_keys: [], content, extensions: {}, enabled: row.enabled !== false, insertion_order: typeof row.insertion_order === 'number' ? row.insertion_order : index, case_sensitive: row.case_sensitive === true, constant: row.constant === true || !keys.length, selective: false, position: row.position === 'after_char' ? 'after_char' : 'before_char' }
  }).filter(entry => !!entry.content)
  const world = text(setting.world)
  if (world) entries.unshift({ id: entries.length, keys: [], secondary_keys: [], content: world, extensions: {}, enabled: true, insertion_order: -1, case_sensitive: false, constant: true, selective: false, position: 'before_char' })
  return entries.length ? { name: '世界设定', extensions: {}, entries } : undefined
}
export function buildTavernCard(value: unknown) {
  const { setting, character, name, description } = settingRecord(value)
  const book = characterBook(setting)
  return { spec: 'chara_card_v2', spec_version: '2.0', data: {
    name, description, personality: text(character.personality, setting.personality), scenario: text(setting.world, setting.scenario),
    first_mes: text(setting.first_mes, setting.firstMessage, setting.greeting, character.firstMessage), mes_example: text(setting.mes_example, setting.examples, setting.exampleDialogue, character.examples),
    creator_notes: '由 HDS-Interlude 导出', system_prompt: text(setting.system_prompt, setting.systemPrompt, setting.instructions, character.systemPrompt),
    post_history_instructions: '', alternate_greetings: [], tags: [], creator: 'HDS-Interlude', character_version: '1.0', extensions: {}, ...(book ? { character_book: book } : {}),
  } }
}
export function createCharacterExport(format: ExportFormat, setting: unknown, config: unknown = {}): CharacterExport {
  const { name } = settingRecord(setting)
  const basename = name.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 60) || '角色'
  const payload = format === 'tavern' ? buildTavernCard(setting) : buildPresetPayload(setting, config)
  return { filename: `${basename}-${format === 'tavern' ? 'st-v2' : 'hdsi'}.${format === 'yaml' ? 'yaml' : 'json'}`, mime: format === 'yaml' ? 'text/yaml' : 'application/json', content: format === 'yaml' ? stringify(payload, { lineWidth: 0 }) : JSON.stringify(payload, null, 2) + '\n' }
}

export async function saveCharacterExport(file: CharacterExport, native: boolean): Promise<string> {
  if (native) {
    if (!navigator.storage?.getDirectory) throw new Error('此 WebView 不支持私有文件保存，请升级 Android System WebView；仍可复制下方内容。')
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle('hds-exports', { create: true })
    const handle = await directory.getFileHandle(file.filename, { create: true })
    const writer = await handle.createWritable()
    try { await writer.write(file.content); await writer.close() } catch (error) { await writer.abort().catch(() => {}); throw error }
    return `opfs:/hds-exports/${file.filename}`
  }
  const url = URL.createObjectURL(new Blob([file.content], { type: `${file.mime};charset=utf-8` }))
  const link = document.createElement('a')
  try { link.href = url; link.download = file.filename; document.body.append(link); link.click() }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
  return `已请求浏览器下载：${file.filename}`
}
