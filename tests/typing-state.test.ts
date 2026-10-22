import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DiagnosticEvent } from '../packages/contracts/diagnostics'
import { characterIsTyping } from '../apps/mobile-ui/typing-state'
import { TypingBubble } from '../apps/mobile-ui/MessageStatus'

const now = 1000000
const event = (stage: string, outcome: string, offset = 0, requestIds = ['request-a']): DiagnosticEvent => ({ id: `${stage}-${outcome}-${offset}`, stage, outcome, at: now + offset, requestIds })
test('typing starts with real processing, survives acknowledgement and ends at each terminal outcome', () => {
  assert.equal(characterIsTyping([event('submission', 'accepted')], now), false)
  const start = event('processing', 'started')
  assert.equal(characterIsTyping([start, event('submission', 'accepted', 1), event('model', 'succeeded', 2)], now + 3), true)
  for (const [stage, outcome] of [['processing', 'settled'], ['processing', 'requeued'], ['processing', 'retry'], ['model', 'failed'], ['decision', 'none'], ['decision', 'delayed'], ['decision', 'failed'], ['delivery', 'delivered'], ['delivery', 'failed'], ['lifecycle', 'interrupted']]) {
    assert.equal(characterIsTyping([start, event(stage, outcome, 1)], now + 2), false, `${stage}/${outcome}`)
  }
  assert.equal(characterIsTyping([start], now + 240001), false, 'No perpetual indicator from a stale event')
  assert.equal(characterIsTyping([event('model', 'started', 1)], now), false, 'Future timestamps do not imply activity')
})
test('typing respects merged requests, independent turns and a successful retry', () => {
  const events = [event('processing', 'started', 0, ['request-a', 'request-b']), event('model', 'failed', 1, ['request-a', 'request-b']), event('model', 'started', 2, ['request-a', 'request-b'])]
  assert.equal(characterIsTyping(events, now + 3), true)
  events.push(event('delivery', 'delivered', 4, ['request-a', 'request-b']))
  assert.equal(characterIsTyping(events, now + 5), false)
  events.push(event('processing', 'started', 3, ['request-c']))
  assert.equal(characterIsTyping(events, now + 5), true, 'Delivering one turn does not end another')
  assert.equal(characterIsTyping([event('model', 'started', 0, [])], now), false, 'Unrelated background work is ignored')
})
test('character bubble remains after submission ends and gives a stable accessible status', () => {
  const markup = renderToStaticMarkup(React.createElement(TypingBubble, { requestState: 'accepted', typing: true, characterName: '星禾' }))
  assert.match(markup, /aria-label="星禾正在输入"/)
  assert.match(markup, /class="message-label">星禾/)
  assert.doesNotMatch(markup, /正在提交消息/)
  assert.equal((markup.match(/<i>/g) ?? []).length, 3)
  assert.equal(renderToStaticMarkup(React.createElement(TypingBubble, { requestState: 'accepted', typing: false })), '')
})
