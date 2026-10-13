export type Card = {
  format: 'v1' | 'v2' | 'v3'; name: string; description: string; personality: string;
  scenario: string; firstMessage: string; alternateGreetings: string[]; examples: string;
  systemPrompt: string; postHistoryInstructions: string; creatorNotes: string;
  raw: Record<string, unknown>; lorebook: Record<string, unknown> | null; warnings: string[];
}
const MAX_JSON = 5 * 1024 * 1024
const decoder = new TextDecoder('utf-8', { fatal: true })
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function validateDepth(value: unknown, depth = 0) {
  if (depth > 64) throw new Error('角色卡对象嵌套超过 64 层')
  if (typeof value === 'string' && value.length > 262144) throw new Error('角色卡单字段超过 256 Ki 字符')
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
  if ('spec' in raw) {
    if (raw.spec !== 'chara_card_v2' && raw.spec !== 'chara_card_v3') throw new Error(`暂不支持角色卡版本：${String(raw.spec)}`)
    if (!record(raw.data)) throw new Error('缺少角色卡 data 对象')
    data = raw.data
    format = raw.spec === 'chara_card_v3' ? 'v3' : 'v2'
  }
  const textField = (key: string) => {
    if (data[key] === undefined || data[key] === null) return ''
    if (typeof data[key] !== 'string') throw new Error(`data.${key} 必须是文本`)
    return data[key] as string
  }
  const name = textField('name').trim()
  if (!name || name.length > 128) throw new Error('角色名称不能为空，最多 128 字符')
  const warnings = ['场景映射为新故事的初始世界；创作者备注与示例不会作为真实历史。']
  const book = record(data.character_book) ? data.character_book : record(data.lorebook_v3) ? data.lorebook_v3 : null
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
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('角色卡 base64 数据损坏')
  const binary = atob(text)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}
export function parseCard(bytes: Uint8Array): Card {
  if (bytes.length > 32 * 1024 * 1024) throw new Error('文件超过 32 MiB')
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((byte, index) => bytes[index] === byte)) return parseJsonCard(decoder.decode(bytes))
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
    if (type === 'tEXt') {
      const separator = body.indexOf(0)
      const key = decoder.decode(body.subarray(0, separator))
      if (separator >= 0 && (key === 'chara' || key === 'ccv3')) {
        if (body.length > MAX_JSON * 1.4) throw new Error('PNG 卡元数据超过限制')
        if (candidates.has(key)) throw new Error(`PNG 存在重复 ${key} 卡数据`)
        candidates.set(key, decoder.decode(body.subarray(separator + 1)))
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
  if (!selected) throw new Error('这张 PNG 没有标准角色卡元数据；本版支持 JSON 与 tEXt PNG')
  if (candidates.size > 1) warnings.push('PNG 同时含 V2/V3 元数据，采用 V3；V3 损坏会拒绝导入。')
  const decoded = fromBase64(selected)
  if (decoded.length > MAX_JSON) throw new Error('PNG 解码元数据超过 5 MiB')
  const card = parseJsonCard(decoder.decode(decoded))
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
