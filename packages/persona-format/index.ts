import { parseDocument, visit, isAlias } from 'yaml'
import { parseCard, parseJsonCard, type Card } from '../card-format'

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const limits: Record<string, number> = { characterName: 60, characterProfile: 20000, userProfile: 20000, relationship: 4000, world: 20000, location: 500, supportingCast: 20000, perspective: 1200, style: 20000, timezone: 60 }
function validateTree(value: unknown, depth = 0) {
  if (depth > 24) throw new Error('HDS 配置嵌套超过 24 层')
  if (typeof value === 'string' && value.length > 262144) throw new Error('配置文本字段过长')
  if (Array.isArray(value)) { for (const child of value) validateTree(child, depth + 1) }
  else if (isRecord(value)) for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('配置包含不支持的对象键')
    validateTree(child, depth + 1)
  }
}

function hdsCard(config: Record<string, unknown>, instance: string): Card {
  if (!isRecord(config.storyDefaults)) throw new Error('配置没有 storyDefaults；纯状态机预设不能作为角色导入')
  const defaults: Record<string, string | string[]> = {}
  for (const [key, limit] of Object.entries(limits)) {
    const value = config.storyDefaults[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.length > limit) throw new Error(`storyDefaults.${key} 必须为文本且不超过 ${limit} 字符`)
    defaults[key] = value
  }
  for (const [key, count] of [['perspectives', 12], ['supplementaryFacts', 20]] as const) {
    const value = config.storyDefaults[key]
    if (value === undefined) continue
    if (!Array.isArray(value) || value.length > count || value.some(item => typeof item !== 'string' || item.length > 800)) throw new Error(`storyDefaults.${key} 列表格式或长度不支持`)
    defaults[key] = value
  }
  if (!String(defaults.characterName ?? '').trim() || !String(defaults.characterProfile ?? '').trim()) throw new Error('HDS 人设需要 characterName 和 characterProfile；纯状态机文件暂不能单独导入')
  if (defaults.timezone) { try { new Intl.DateTimeFormat('zh-CN', { timeZone: String(defaults.timezone) }) } catch { throw new Error('人设时区无效') } }
  const ignored = Object.keys(config).filter(key => key !== 'storyDefaults')
  const unknown = Object.keys(config.storyDefaults).filter(key => !(key in defaults))
  const warnings = [`HDS 原生人设${instance ? ` · ${instance}` : ''}：姓名、档案、世界、地点、关系、视角、配角、文风和时区进入 HDS。`, '只导入人设。模型密钥、QQ 账号与插件配置不保存、不执行。', '人设自带的用户档案仅在手机“你的故事人设”留空时用于新故事。']
  if (ignored.length) warnings.push(`以下配置分区未导入：${ignored.join('、')}。持续生活、模型分工等由手机设置控制。`)
  if (unknown.length) warnings.push(`未识别的人设字段未导入：${unknown.join('、')}。`)
  const raw = { storyDefaults: defaults }
  return { format: 'hds', name: String(defaults.characterName).trim(), description: String(defaults.characterProfile), personality: '', scenario: String(defaults.world ?? ''), firstMessage: '', alternateGreetings: [], examples: '', systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', raw, lorebook: null, warnings, hds: { storyDefaults: defaults } }
}

/** Downloaded typ0 koishi.yml, HDS JSON/envelopes, or existing Tavern JSON/PNG. */
export function parsePersona(bytes: Uint8Array): Card[] {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return [parseCard(bytes)]
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('JSON / YAML 配置超过 5 MiB')
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  let value: unknown
  try {
    const document = parseDocument(text, { schema: 'core', uniqueKeys: true, prettyErrors: false, strict: true, stringKeys: true })
    if (document.errors.length || document.warnings.length) throw new Error('parse')
    visit(document, (_key, node) => { if (isAlias(node)) throw new Error('alias') })
    value = document.toJS({ maxAliasCount: 0 })
  } catch { throw new Error('JSON / YAML 无法解析：请检查语法；重复键、自定义标签、锚点引用和多文档暂不支持') }
  if (!isRecord(value)) throw new Error('人设文件必须包含配置对象')
  if ('spec' in value || typeof value.name === 'string') return [parseJsonCard(JSON.stringify(value))]
  validateTree(value)
  const candidates: { value: Record<string, unknown>; path: string }[] = []
  const scan = (node: Record<string, unknown>, path = '') => {
    for (const [key, child] of Object.entries(node)) {
      if (!isRecord(child)) continue
      if (/^hds-interlude(?::.*)?$/.test(key)) candidates.push({ value: child, path: path + key })
      else if (key === 'plugins' || /^group(?::.*)?$/.test(key)) scan(child, path + key + '.')
    }
  }
  if (isRecord(value.preset) && isRecord(value.preset.payload)) value = value.preset.payload
  else if (isRecord(value.payload)) value = value.payload
  const root = value as Record<string, unknown>
  if (isRecord(root.storyDefaults)) candidates.push({ value: root, path: '' })
  else scan(root)
  if (!candidates.length) throw new Error('未找到 HDS 人设块，支持 typ0 下载的 koishi.yml、HDS JSON 或酒馆角色卡')
  if (candidates.length > 32) throw new Error('HDS 实例过多，最多支持 32 个')
  return candidates.map(candidate => hdsCard(candidate.value, candidate.path))
}

export type CardEdits = Pick<Card, 'name' | 'description' | 'personality' | 'scenario' | 'firstMessage' | 'examples' | 'systemPrompt' | 'postHistoryInstructions'> & Pick<Partial<Card>, 'hds'>
export function editPersona(card: Card, edits: CardEdits): Card {
  if (card.format === 'hds') {
    const defaults = { ...(edits.hds ?? card.hds)?.storyDefaults, characterName: edits.name, characterProfile: edits.description, world: edits.scenario }
    return hdsCard({ storyDefaults: defaults }, '')
  }
  const raw = structuredClone(card.raw)
  const target = card.format === 'v1' ? raw : raw.data as Record<string, unknown>
  Object.assign(target, { name: edits.name, description: edits.description, personality: edits.personality, scenario: edits.scenario, first_mes: edits.firstMessage, mes_example: edits.examples, system_prompt: edits.systemPrompt, post_history_instructions: edits.postHistoryInstructions })
  return parseJsonCard(JSON.stringify(raw))
}

export function importBytes(card: Card, original: Uint8Array): Uint8Array {
  return card.format === 'hds' ? new TextEncoder().encode(JSON.stringify(card.raw)) : original
}
