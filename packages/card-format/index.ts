export type Card = {
  format: 'v1' | 'v2' | 'v3' | 'hds'; name: string; description: string; personality: string;
  scenario: string; firstMessage: string; alternateGreetings: string[]; examples: string;
  systemPrompt: string; postHistoryInstructions: string; creatorNotes: string;
  raw: Record<string, unknown>; lorebook: Record<string, unknown> | null; warnings: string[];
  hds?: { storyDefaults: Record<string, string | string[]> };
  revision?: number;
}
const MAX_JSON = 16 * 1024 * 1024
const MAX_FILE = 32 * 1024 * 1024
const MAX_FIELD = 1024 * 1024
const decoder = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('latin1')
// 旧版 TavernAI/Pygmalion 字段名 → 标准字段（仅无 spec 的裸 JSON 卡使用）
const LEGACY_FIELDS: Record<string, string> = { name: 'char_name', description: 'char_persona', first_mes: 'char_greeting', scenario: 'world_scenario', mes_example: 'example_dialogue' }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function validateDepth(value: unknown, depth = 0) {
  if (depth > 64) throw new Error('角色卡对象嵌套超过 64 层')
  if (typeof value === 'string' && value.length > MAX_FIELD) throw new Error('角色卡单字段超过 1 Mi 字符')
  if (Array.isArray(value)) value.forEach(item => validateDepth(item, depth + 1))
  else if (record(value)) Object.values(value).forEach(item => validateDepth(item, depth + 1))
}
export function parseJsonCard(text: string): Card {
  if (new TextEncoder().encode(text).length > MAX_JSON) throw new Error('JSON 元数据超过 5 MiB')
  const raw: unknown = JSON.parse(text)
  if (!record(raw)) throw new Error('角色卡必须是 JSON 对象')
  validateDepth(raw)
  let data = raw
  let format: Card['format'] = 'v1'
  const warnings: string[] = []
  const spec = typeof raw.spec === 'string' ? raw.spec.trim().toLowerCase() : ''
  if (spec) {
    if (!record(raw.data)) throw new Error('缺少角色卡 data 对象')
    data = raw.data
    if (/^(?:chara|character)_card_v3$|^ccv3$|^v3(?:\.\d+)*$/.test(spec)) format = 'v3'
    else if (/^(?:chara|character)_card_v2$|^ccv2$|^v2(?:\.\d+)*$/.test(spec)) format = 'v2'
    else { format = 'v3'; warnings.push(`未识别的角色卡版本 spec=${String(raw.spec)}，已按 V3 结构尽力解析。`) }
  } else if (record((raw as { data?: unknown }).data) && typeof (raw as { data: Record<string, unknown> }).data.name === 'string') {
    data = (raw as { data: Record<string, unknown> }).data
    format = 'v2'
    warnings.push('角色卡没有 spec 字段，已按 V2 结构（data 对象）解析。')
  } else if (typeof raw.name !== 'string' && typeof raw.char_name === 'string') {
    warnings.push('检测到旧版 TavernAI 字段名（char_name 等），已按兼容映射导入。')
  }
  const textField = (key: string) => {
    const source = data[key] === undefined && format === 'v1' ? LEGACY_FIELDS[key] : key
    const value = source ? data[source] : undefined
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') throw new Error(`data.${key} 必须是文本`)
    return value
  }
  let name = textField('name').trim()
  if (!name) throw new Error('角色名称不能为空（支持 name 或旧版 char_name）')
  if (name.length > 128) { name = name.slice(0, 128); warnings.push('角色名称超过 128 字符，已截断。') }
  warnings.push('场景映射为新故事的初始世界；创作者备注与示例不会作为真实历史。')
  const book = record(data.character_book) ? data.character_book : record(data.lorebook_v3) ? data.lorebook_v3 : record(data.lorebook) ? data.lorebook : null
  if (book) warnings.push('世界书按关键词与常驻条目触发；正则和第三方扩展只保留，暂不执行。预算为保守估算。')
  if (format === 'v3') warnings.push('V3 资源链接只保留，本版不下载外链，不执行脚本或 CHARX 资源。')
  if (data.extensions) warnings.push('未知 extensions 原样保存，不执行扩展脚本。')
  return { format, name, description: textField('description'), personality: textField('personality'), scenario: textField('scenario'), firstMessage: textField('first_mes'), alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.filter((x): x is string => typeof x === 'string') : [], examples: textField('mes_example'), systemPrompt: textField('system_prompt'), postHistoryInstructions: textField('post_history_instructions'), creatorNotes: textField('creator_notes'), raw, lorebook: book, warnings }
}
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
export function fromBase64(text: string): Uint8Array {
  const normalized = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4))
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(padded)) throw new Error('角色卡 base64 数据损坏')
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}
/** PNG 元数据既可能是 base64，也可能是直接写入的 UTF-8 JSON（部分第三方工具）。 */
export function decodeCardText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return trimmed
  return new TextDecoder().decode(fromBase64(trimmed))
}
export function parseCard(bytes: Uint8Array): Card {
  if (bytes.length > MAX_FILE) throw new Error('文件超过 32 MiB')
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((byte, index) => bytes[index] === byte)) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) throw new Error('这是 ZIP 压缩包（.charx 等），本版请导入 PNG 或 JSON 角色卡')
    let text: string
    try { text = decoder.decode(bytes).replace(/^\uFEFF/, '') } catch { throw new Error('文件既不是 PNG 也不是 UTF-8 文本；若是压缩包请解压后导入其中的 JSON') }
    return parseJsonCard(text)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const candidates = new Map<string, string>()
  const warnings: string[] = []
  let offset = 8, ended = false, chunks = 0
  while (offset < bytes.length) {
    if (++chunks > 10000 || offset + 12 > bytes.length) throw new Error('PNG 块结构损坏')
    const length = view.getUint32(offset)
    if (length > bytes.length - offset - 12) throw new Error('PNG 块长度越界')
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) throw new Error(`PNG ${type} 校验失败`)
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      let key = ''
      let value: string | null = null
      let compressed = false
      const separator = body.indexOf(0)
      if (separator >= 0) {
        key = latin1.decode(body.subarray(0, separator))
        if (type === 'tEXt') value = new TextDecoder().decode(body.subarray(separator + 1))
        else if (type === 'zTXt') compressed = body[separator + 1] === 0
        else {
          compressed = body[separator + 1] === 1
          const languageEnd = body.indexOf(0, separator + 3)
          const translatedEnd = languageEnd < 0 ? -1 : body.indexOf(0, languageEnd + 1)
          if (translatedEnd >= 0 && !compressed) value = new TextDecoder().decode(body.subarray(translatedEnd + 1))
        }
      }
      if (key === 'chara' || key === 'ccv3') {
        if (compressed) throw new Error('这张 PNG 使用压缩角色卡元数据（zTXt 或压缩 iTXt），请用 SillyTavern 重新导出为 PNG，或导入同名 JSON')
        if (value === null) throw new Error(`PNG ${type} 卡元数据块损坏`)
        if (body.length > MAX_JSON * 1.4) throw new Error('PNG 卡元数据超过限制')
        if (candidates.has(key)) throw new Error(`PNG 存在重复 ${key} 卡数据`)
        candidates.set(key, value)
      }
    }
    if (type === 'IHDR') {
      if (length !== 13 || view.getUint32(offset + 8) * view.getUint32(offset + 12) > 16000000) throw new Error('PNG 图片尺寸超过限制')
    }
    offset += length + 12
    if (type === 'IEND') { if (length !== 0 || offset !== bytes.length) throw new Error('PNG 结束块损坏'); ended = true; break }
  }
  if (!ended) throw new Error('PNG 缺少结束块')
  const selected = candidates.get('ccv3') ?? candidates.get('chara')
  if (!selected) throw new Error('这张 PNG 没有角色卡元数据（读取 tEXt / iTXt 的 chara、ccv3 块）；请确认是酒馆导出的角色卡 PNG')
  if (candidates.size > 1) warnings.push('PNG 同时含 V2/V3 元数据，采用 V3；V3 损坏会拒绝导入。')
  const jsonText = decodeCardText(selected)
  if (new TextEncoder().encode(jsonText).length > MAX_JSON) throw new Error('PNG 内角色卡数据超过 16 MiB')
  const card = parseJsonCard(jsonText)
  card.warnings.push(...warnings)
  return card
}

export function cardPrompt(card: Card, userName: string, history: string[]): { before: string; after: string; trace: string[] } {
  const macro = (text: string) => text.replaceAll('{{char}}', card.name).replaceAll('{{user}}', userName).replaceAll('{{original}}', '')
  const entries = Array.isArray(card.lorebook?.entries) ? card.lorebook.entries : []
  const scanDepth = Math.max(1, Math.min(30, Number(card.lorebook?.scan_depth) || 10))
  const configuredBudget = Number(card.lorebook?.token_budget ?? 1024)
  const budget = Math.max(0, Math.min(4096, Number.isFinite(configuredBudget) ? configuredBudget : 1024))
  const recent = history.slice(-scanDepth).join('\n')
  const trace: string[] = [], selected: { content: string; order: number; after: boolean; priority: number }[] = []
  for (const [index, value] of entries.slice(0, 2000).entries()) {
    if (!record(value) || value.enabled === false) continue
    if (value.use_regex === true) { trace.push(`条目 ${index}：正则未支持，跳过`); continue }
    const haystack = value.case_sensitive === true ? recent : recent.toLowerCase()
    const matches = (keys: unknown) => Array.isArray(keys) && keys.some(key => typeof key === 'string' && key.length > 0 && haystack.includes(value.case_sensitive === true ? key : key.toLowerCase()))
    if (value.constant !== true && (!matches(value.keys) || value.selective === true && !matches(value.secondary_keys))) continue
    if (typeof value.content !== 'string') continue
    selected.push({ content: macro(value.content), order: Number(value.insertion_order) || 0, after: value.position === 'after_char', priority: Number(value.priority) || 0 })
    trace.push(`条目 ${index}：${value.constant === true ? '常驻' : '关键词命中'}`)
  }
  selected.sort((a, b) => b.priority - a.priority || a.order - b.order)
  let remaining = budget
  const accepted = selected.slice(0, 64).filter(entry => { const estimate = Array.from(entry.content).length; if (estimate > remaining) { trace.push('条目因预算裁剪'); return false }; remaining -= estimate; return true }).sort((a, b) => a.order - b.order)
  const before = [card.systemPrompt && `角色行为提示（保留 HDS 输出与投递合约）：\n${macro(card.systemPrompt)}`, card.examples && `角色对话示例（风格参考，未实际发生）：\n${macro(card.examples)}`, ...accepted.filter(entry => !entry.after).map(entry => `世界书设定（非历史）：\n${entry.content}`)].filter(Boolean).join('\n\n')
  const after = [...accepted.filter(entry => entry.after).map(entry => `世界书设定（非历史）：\n${entry.content}`), card.postHistoryInstructions && `角色后置行为提示（仍遵守 HDS JSON 合约）：\n${macro(card.postHistoryInstructions)}`].filter(Boolean).join('\n\n')
  return { before, after, trace }
}
