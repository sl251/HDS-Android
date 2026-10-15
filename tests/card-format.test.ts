import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { parseCard, parseJsonCard, crc32, cardPrompt } from '../packages/card-format'
const raw = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: '星禾🌱', description: '海边修理旧收音机的人', personality: '安静', first_mes: '你好，{{user}}。', creator_notes: 'THIS_IS_NOT_CANON', mes_example: '{{char}}: 晚上好', extensions: { custom: { preserved: true } }, character_book: { token_budget: 100, entries: [{ enabled: true, keys: ['收音机'], content: '使用旧型号青木收音机', insertion_order: 1 }, { enabled: false, constant: true, content: 'DISABLED_LORE' }] } } }
function pngChunk(type: string, payload: Buffer) {
  const bytes = Buffer.concat([Buffer.from(type), payload]); const header = Buffer.alloc(4), crc = Buffer.alloc(4)
  header.writeUInt32BE(payload.length); crc.writeUInt32BE(crc32(bytes)); return Buffer.concat([header, bytes, crc])
}
function pngBytes(chunks: Buffer[], rawText = false) {
  const dimensions = Buffer.alloc(13); dimensions.writeUInt32BE(1, 0); dimensions.writeUInt32BE(1, 4)
  const text = JSON.stringify(raw)
  const tEXt = Buffer.concat([Buffer.from('chara\0'), rawText ? Buffer.from(text) : Buffer.from(Buffer.from(text).toString('base64'))])
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', dimensions), ...chunks, pngChunk('tEXt', tEXt), pngChunk('IEND', Buffer.alloc(0))])
}
function zlibDeflate(data: Buffer) { return deflateSync(data) }
function pngZtxt() {
  const dimensions = Buffer.alloc(13); dimensions.writeUInt32BE(1, 0); dimensions.writeUInt32BE(1, 4)
  const body = Buffer.concat([Buffer.from('chara\0\0'), zlibDeflate(Buffer.from(JSON.stringify(raw)))])
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', dimensions), pngChunk('zTXt', body), pngChunk('IEND', Buffer.alloc(0))])
}
test('V2 JSON and PNG preserve Chinese, emoji and unknown extensions', () => { const json = parseJsonCard(JSON.stringify(raw)); const parsed = parseCard(pngBytes([])); assert.equal(json.name, '星禾🌱'); assert.deepEqual(parsed.raw, raw); assert.equal(parsed.examples, '{{char}}: 晚上好') })
test('oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped', () => {
  assert.throws(() => parseJsonCard(JSON.stringify({ name: 'x', description: 'x'.repeat(1024 * 1024 + 1) })), /超过/)
  const unknown = parseJsonCard('{"spec":"future","data":{"name":"x","description":"d"}}')
  assert.equal(unknown.name, 'x'); assert.equal(unknown.format, 'v3'); assert.ok(unknown.warnings.some(w => w.includes('未识别')))
  const longName = parseJsonCard(JSON.stringify({ name: 'a'.repeat(200), description: 'd' }))
  assert.equal(longName.name, 'a'.repeat(128)); assert.ok(longName.warnings.some(w => w.includes('截断')))
  const legacy = parseJsonCard(JSON.stringify({ char_name: '旧卡', char_persona: '旧描述', first_mes: '你好' }))
  assert.equal(legacy.name, '旧卡'); assert.equal(legacy.description, '旧描述'); assert.equal(legacy.firstMessage, '你好')
})
test('PNG raw-text tEXt, wrapped base64, and zTXt compressed cards', () => {
  const rawText = parseCard(pngBytes([], true)); assert.equal(rawText.name, '星禾🌱')
  const wrapped = Buffer.from(Buffer.from(JSON.stringify(raw)).toString('base64').match(/.{1,76}/g)!.join('\n'))
  const wrapPng = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', (() => { const d = Buffer.alloc(13); d.writeUInt32BE(1, 0); d.writeUInt32BE(1, 4); return d })()), pngChunk('tEXt', Buffer.concat([Buffer.from('chara\0'), wrapped])), pngChunk('IEND', Buffer.alloc(0))])
  assert.equal(parseCard(wrapPng).name, '星禾🌱')
  assert.throws(() => parseCard(pngZtxt()), /请用 SillyTavern 重新导出/)
})
test('lore triggers against delivered history; creator notes and disabled lore stay out', () => { const card = parseJsonCard(JSON.stringify(raw)); const prompt = cardPrompt(card, '小林', ['我的收音机坏了']); assert.match(prompt.before, /青木/); assert.match(prompt.before, /星禾🌱: 晚上好/); assert.doesNotMatch(prompt.before, /THIS_IS_NOT_CANON|DISABLED_LORE/); assert.doesNotMatch(cardPrompt(card, '小林', ['晚上好']).before, /青木/) })
test('regex lore is preserved but never executed and budgets visibly trim', () => { const card = parseJsonCard(JSON.stringify({ ...raw, data: { ...raw.data, character_book: { token_budget: 3, entries: [{ constant: true, content: 'too large for this budget' }, { constant: true, content: 'x', use_regex: true, keys: ['(a+)+$'] }] } } })); const prompt = cardPrompt(card, '我', ['aaaa']); assert.doesNotMatch(prompt.before, /too large/); assert.ok(prompt.trace.some(line => line.includes('预算'))); assert.ok(prompt.trace.some(line => line.includes('正则'))) })
