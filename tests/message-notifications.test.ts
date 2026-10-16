import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { messagePush, messagesSinceQuery, serializeMessagePush } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

const row = { id: 'push-fixture', content: '第一行\n第二行', occurredAt: new Date('2026-10-16T10:00:01Z') }
test('message push is exactly one stdout marker and one JSON line, with full text and ISO time', () => {
  const line = serializeMessagePush(row)
  assert.equal(line.split('\n').length, 2)
  assert.ok(line.startsWith('HDS_MSG_PUSH {'))
  assert.deepEqual(JSON.parse(line.slice(13)), { id: row.id, content: '第一行', fullContent: row.content, occurredAt: '2026-10-16T10:00:01.000Z' })
})
test('notification text uses first text line, bounds code points and never exposes image markup', () => {
  assert.equal(messagePush({ ...row, content: '😀'.repeat(45) + '\n后文' }).content, '😀'.repeat(40))
  assert.equal(messagePush({ ...row, content: '<img src="https://example.com/private.png"/>' }).content, '[图片]')
  assert.equal(messagePush({ ...row, content: '<img src="x"/>\n看这张图\n第二段' }).content, '看这张图')
  assert.equal(messagePush({ ...row, content: '首段\n<img src="x"/>' }).fullContent, '首段')
})
test('since query is character-only and strictly greater, with equivalent ISO offsets', () => {
  assert.deepEqual(messagesSinceQuery('2026-10-16T18:00:01+08:00'), { direction: 'character', occurredAt: { $gt: row.occurredAt } })
  for (const invalid of [undefined, 42, 'invalid', '2026-10-16', '2026-15-16T00:00:00Z']) assert.throws(() => messagesSinceQuery(invalid))
})
