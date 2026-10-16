import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { messageStatusLabel, type Message } from '../packages/contracts'
import { createReplyWatermarks } from '../apps/mobile-ui/message-state'
import { MessageStatus, TypingBubble } from '../apps/mobile-ui/MessageStatus'

const user: Message = { id: 'preview9-user-001', direction: 'user', content: '你好', occurredAt: '2026-10-16T10:00:00Z', status: 'accepted' }
const reply: Message = { ...user, id: 'preview9-reply-001', direction: 'character', status: 'delivered', occurredAt: '2026-10-16T10:00:01Z' }

test('Preview 9 accepted messages derive delivered/read labels without mutating stored status', () => {
  const original = structuredClone(user)
  assert.equal(messageStatusLabel(user), '已送达')
  assert.equal(messageStatusLabel(user, Date.parse(user.occurredAt)), '已送达', 'Equal timestamps are not read')
  assert.equal(messageStatusLabel(user, Date.parse(reply.occurredAt)), '已读')
  assert.equal(messageStatusLabel(user, Date.parse('2026-10-16T18:00:01+08:00')), '已读')
  assert.equal(messageStatusLabel({ ...user, occurredAt: 'invalid' }, Date.parse(reply.occurredAt)), '已送达')
  assert.deepEqual(user, original)
  for (const ts of [0, Date.parse(reply.occurredAt)]) {
    const markup = renderToStaticMarkup(React.createElement(MessageStatus, { message: user, lastCharacterReplyTs: ts }))
    assert.match(markup, /<svg[^>]*class="delivery-checks"/)
    assert.ok(markup.includes(ts ? '已读' : '已送达'))
  }
})

test('Preview 9 failed status is a retry button, delivered replies are quiet, and openings retain their label', () => {
  const failed = { ...user, status: 'failed' }
  assert.equal(messageStatusLabel(failed), '未送达·点击重试')
  assert.match(renderToStaticMarkup(React.createElement(MessageStatus, { message: failed, onRetry() {} })), /<button[^>]*>未送达·点击重试<\/button>/)
  assert.equal(messageStatusLabel(reply), '')
  assert.equal(renderToStaticMarkup(React.createElement(MessageStatus, { message: reply })), '')
  const opening = { ...reply, status: 'card-opening' }
  assert.equal(messageStatusLabel(opening), '角色卡开场白 · 本地已展示')
  assert.match(renderToStaticMarkup(React.createElement(MessageStatus, { message: opening })), /class="message-opening">角色卡开场白 · 本地已展示/)
})

test('Preview 9 local reply watermarks isolate cards, survive reload and the history window, and reset with a story', () => {
  const values = new Map<string, string>()
  const storage = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  const watermarks = createReplyWatermarks(storage)
  assert.equal(watermarks.observe('first', [user, { ...reply, status: 'card-opening' }, { ...reply, status: 'failed' }, { ...reply, occurredAt: 'invalid' }]), 0)
  assert.equal(values.size, 0)
  const ts = watermarks.observe('first', [reply])
  assert.equal(ts, Date.parse(reply.occurredAt))
  assert.equal(watermarks.get('second'), 0)
  assert.equal(watermarks.observe('first', [user]), ts, 'A moving history window must not regress read receipts')
  assert.deepEqual([...values], [['hds-lastCharacterReplyTs-first', String(ts)]], 'Only a reply timestamp is persisted')
  const reloaded = createReplyWatermarks(storage)
  assert.equal(messageStatusLabel(user, reloaded.get('first')), '已读')
  assert.equal(messageStatusLabel(user, reloaded.get('second')), '已送达')
  reloaded.clear('first')
  assert.equal(createReplyWatermarks(storage).get('first'), 0)
  values.set('hds-lastCharacterReplyTs-broken', 'not-a-number')
  assert.equal(reloaded.get('broken'), 0)
})

test('Preview 9 read receipts still work when local storage is unavailable', () => {
  const watermarks = createReplyWatermarks(() => { throw new Error('storage unavailable') })
  watermarks.observe('first', [reply])
  assert.equal(messageStatusLabel(user, watermarks.get('first')), '已读')
  watermarks.clear('first')
  assert.equal(watermarks.get('first'), 0)
})

test('Preview 9 typing bubble has three static dots only during a send request', () => {
  const markup = renderToStaticMarkup(React.createElement(TypingBubble, { requestState: 'sending' }))
  assert.match(markup, /role="status" aria-label="正在输入…"/)
  assert.equal((markup.match(/<i>/g) ?? []).length, 3)
  for (const requestState of ['idle', 'accepted', 'failed', 'unknown']) assert.equal(renderToStaticMarkup(React.createElement(TypingBubble, { requestState })), '')
})
