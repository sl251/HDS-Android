import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diagnosticsMessageFocus, type DiagnosticMessageEvent, type DiagnosticMessagesResult, type Message } from '../packages/contracts'
import { diagnosticError } from '../runtime/message-diagnostics'
import { aggregateDiagnosticMessages, diagnosticAdvice, diagnosticConnection, diagnosticDuration, diagnosticHelp, diagnosticTime, diagnosticsEmptyText, genericDiagnosticAdvice, visibleDiagnosticMessages } from '../apps/mobile-ui/message-diagnostics'
import { DiagnosticMessageCard } from '../apps/mobile-ui/DiagnosticMessageCard'
import { MessageFailureHint } from '../apps/mobile-ui/MessageFailureHint'
import type { HostConfig } from '../runtime/host'

const row = (id: string, patch: Partial<DiagnosticMessageEvent> = {}): DiagnosticMessageEvent => ({ id, at: 1000, requestIds: ['request-first'], stage: 'model', outcome: 'failed', reason: 'timeout', ...patch })
const history = (id: string, content: string): Message => ({ id, content, direction: 'user', status: 'accepted', occurredAt: new Date(1000).toISOString() })

test('P1 all 12 classified reasons have Chinese labels and actionable advice; unknown codes use the fallback', () => {
  const cases: [unknown, keyof typeof diagnosticHelp, RegExp][] = [
    [{ code: 'HDS_NOT_ACCEPTED' }, 'not_accepted', /唤醒/], [{ code: 'HDS_MOBILE_BUDGET' }, 'background_budget', /后台预算/],
    [{ status: 402 }, 'provider_quota', /充值/], [{ status: 401 }, 'authentication', /测试连接/], [{ status: 403 }, 'permission', /权限/],
    [new Error('rate_limit'), 'rate_limit', /1-2 分钟/], [{ status: 429 }, 'throttled_or_quota', /额度/],
    [new Error('timeout'), 'timeout', /120 秒/], [new Error('network'), 'network', /备用连接/],
    [{ status: 503 }, 'provider_error', /自动重试/], [{ status: 400 }, 'invalid_request', /请求参数/], [null, 'unknown_error', /原因码/],
  ]
  assert.deepEqual(cases.map(([, reason]) => reason).sort(), Object.keys(diagnosticHelp).sort())
  for (const [error, reason, advice] of cases) {
    assert.equal(diagnosticError(error), reason)
    assert.match(diagnosticAdvice(reason), advice)
    const card = aggregateDiagnosticMessages([row(reason, { reason })])[0]
    const html = renderToStaticMarkup(React.createElement(DiagnosticMessageCard, { message: card }))
    assert.ok(html.includes(diagnosticHelp[reason].label)); assert.ok(html.includes(diagnosticAdvice(reason)))
    assert.match(html, /data-stage="model" data-state="failed" aria-current="step"/)
  }
  assert.equal(diagnosticAdvice('future_unknown_code'), genericDiagnosticAdvice)
  assert.equal(diagnosticAdvice(), genericDiagnosticAdvice)
})

test('P1 aggregation joins request/delivery aliases, deduplicates events, sorts details and truncates to 40 Unicode characters', () => {
  const events = [row('last', { at: 3000, stage: 'delivery', outcome: 'delivered', messageId: 'reply-first', reason: undefined }), row('first', { at: 1000 }), row('middle', { at: 2000, outcome: 'succeeded', reason: undefined }), row('middle', { at: 2000, outcome: 'succeeded', reason: undefined })]
  const card = aggregateDiagnosticMessages(events, [history('request-first', '你'.repeat(39) + '😀后续')])[0]
  assert.equal(aggregateDiagnosticMessages(events).length, 1)
  assert.deepEqual(card.events.map(event => event.id), ['first', 'middle', 'last'])
  assert.deepEqual(card.aliases, ['request-first', 'reply-first'])
  assert.equal(card.preview, '你'.repeat(39) + '😀…')
  assert.equal(events[0].id, 'last', 'Aggregation must not mutate the bridge response')
  assert.equal(visibleDiagnosticMessages([card], 'all', 'reply-first')[0].id, 'request-first')
  const onlyMessageId = aggregateDiagnosticMessages([row('a', { requestIds: [], messageId: 'same-message' }), row('b', { requestIds: [], messageId: 'same-message' })])
  assert.equal(onlyMessageId.length, 1); assert.equal(onlyMessageId[0].events.length, 2)
})

test('P1 merged inputs share events without inventing associations for independent messages or orphan records', () => {
  const cards = aggregateDiagnosticMessages([
    row('first', { stage: 'submission', requestIds: ['first-input'] }), row('second', { stage: 'submission', requestIds: ['second-input'] }),
    row('shared', { requestIds: ['first-input', 'second-input'], messageId: 'shared-reply' }),
    row('reply-only', { requestIds: [], messageId: 'shared-reply' }), row('unrelated', { requestIds: ['third-input'] }), row('orphan', { requestIds: [] }),
  ])
  assert.equal(cards.length, 4)
  assert.deepEqual(cards.find(card => card.id === 'first-input')!.events.map(event => event.id), ['first', 'shared', 'reply-only'])
  assert.deepEqual(cards.find(card => card.id === 'second-input')!.events.map(event => event.id), ['second', 'shared', 'reply-only'])
  assert.equal(cards.find(card => card.id === 'third-input')!.events.length, 1)
  assert.equal(cards.find(card => card.id === 'event:orphan')!.preview, '未关联消息的记录')
})

test('P1 failed retries remain visible until recovery, without misreporting silence, delayed delivery or missing records', () => {
  const initial = [row('failed'), row('decision', { at: 2000, stage: 'decision', outcome: 'failed', reason: undefined }), row('settled', { at: 3000, stage: 'processing', outcome: 'settled', reason: undefined })]
  assert.equal(aggregateDiagnosticMessages(initial)[0].failure?.reason, 'timeout')
  const retrying = aggregateDiagnosticMessages([...initial, row('retrying', { at: 4000, outcome: 'started', attempt: 2, reason: undefined })])[0]
  assert.equal(retrying.modelFailure, undefined); assert.equal(retrying.steps[2].state, 'active'); assert.equal(retrying.failure, undefined)
  const recovered = aggregateDiagnosticMessages([...initial, row('retrying', { at: 4000, outcome: 'started', reason: undefined }), row('recovered', { at: 5000, outcome: 'succeeded', reason: undefined }), row('silent', { at: 6000, stage: 'decision', outcome: 'none', reason: undefined })])[0]
  assert.equal(recovered.failure, undefined); assert.equal(recovered.recovered, true)
  assert.equal(recovered.steps[5].state, 'skipped'); assert.equal(recovered.currentStep, 3)
  const delayed = aggregateDiagnosticMessages([row('delayed', { stage: 'decision', outcome: 'delayed', reason: undefined })])[0]
  assert.equal(delayed.failure, undefined); assert.equal(delayed.steps[5].label, '等待后续投递'); assert.equal(delayed.currentStep, 5)
  const incomplete = aggregateDiagnosticMessages([row('unknown', { stage: 'commit', outcome: 'succeeded', reason: undefined })])[0]
  assert.equal(incomplete.steps[2].state, 'missing'); assert.equal(incomplete.failure, undefined)
  const interrupted = aggregateDiagnosticMessages([row('restart', { stage: 'lifecycle', outcome: 'interrupted', reason: 'restart' })])[0]
  assert.equal(interrupted.steps[1].state, 'failed')
  const processingFailure = aggregateDiagnosticMessages([row('processing-error', { stage: 'processing', outcome: 'failed', reason: 'unknown_error' }), row('cleanup', { at: 2000, stage: 'processing', outcome: 'settled', reason: undefined })])[0]
  assert.equal(processingFailure.failure?.reason, 'unknown_error', 'Turn cleanup must not hide the actual failure')
  const queuedRetry = aggregateDiagnosticMessages([row('retry', { stage: 'processing', outcome: 'retry', reason: undefined }), row('cleanup', { at: 2000, stage: 'processing', outcome: 'settled', reason: undefined })])[0]
  assert.equal(queuedRetry.steps[1].label, '等待重试')
})

test('P1 limits message cards to 200, latest to 20, and retains an older focused message', () => {
  const cards = aggregateDiagnosticMessages(Array.from({ length: 2000 }, (_, n) => row(`event-${n}`, { at: n, requestIds: [`message-${n % 205}`], outcome: n % 2 ? 'failed' : 'succeeded' })))
  assert.equal(cards.length, 205)
  assert.equal(visibleDiagnosticMessages(cards, 'all').length, 200)
  const focus = cards.at(-1)!.id
  const selected = visibleDiagnosticMessages(cards, 'all', focus)
  assert.equal(selected.length, 200); assert.ok(selected.some(card => card.id === focus))
  assert.equal(visibleDiagnosticMessages(cards, 'latest').length, 20)
  assert.ok(visibleDiagnosticMessages(cards, 'failed').every(card => card.failure))
  assert.deepEqual(aggregateDiagnosticMessages([]), [])
  assert.equal(diagnosticsEmptyText(), '一切正常，暂无诊断记录')
  assert.match(diagnosticsEmptyText('deleted-message'), /暂无保留/)
  assert.match(diagnosticsEmptyText('', 'failed'), /暂无失败/)
})

test('P1 renders relative dates, seconds, provider names/fallbacks, attempt badges and all retained event fields', () => {
  assert.equal(diagnosticDuration(999), '不足 1 秒'); assert.equal(diagnosticDuration(1000), '1.0 秒'); assert.equal(diagnosticDuration(1250), '1.3 秒')
  const now = Date.now()
  assert.equal(diagnosticTime(now - 180000, now), '3 分钟前'); assert.equal(diagnosticTime(now - 7200000, now), '2 小时前')
  assert.equal(diagnosticTime(now - 86400000, now), new Date(now - 86400000).toLocaleDateString('zh-CN'))
  assert.equal(diagnosticConnection(row('label', { providerLabel: '我的连接', providerSlot: 1 })), '我的连接')
  assert.equal(diagnosticConnection(row('old', { providerSlot: 2 })), '连接 #2')
  const card = aggregateDiagnosticMessages([row('detail', { at: now - 180000, providerLabel: '我的连接', providerSlot: 1, elapsedMs: 1250, attempt: 2, willingness: 0.5, count: 3, entryId: 42, messageId: 'delivered-id', mode: 'voice' })])[0]
  const html = renderToStaticMarkup(React.createElement(DiagnosticMessageCard, { message: card, focused: true }))
  for (const text of ['1.3 秒', '第 2 次尝试', '我的连接', '0.5', '42', 'delivered-id', '语音', 'request-first', 'detail', 'timeout']) assert.ok(html.includes(text), text)
  assert.equal((html.match(/aria-label="第\d步/g) ?? []).length, 6)
  assert.doesNotMatch(html, /1250 ms/)
})

test('P1 chat focus navigation is a shared contract carrying exactly the selected messageId', () => {
  const focus = diagnosticsMessageFocus('request-first')
  assert.deepEqual(focus, { type: 'diagnostics.message.focus', messageId: 'request-first' })
  const hint = renderToStaticMarkup(React.createElement(MessageFailureHint, { messageId: focus.messageId, reason: 'timeout', focus: () => {} }))
  assert.match(hint, /该消息模型调用失败 · 请求超时/); assert.match(hint, /查看诊断/)
})

test('P1 host labels only live-session slots and preserves messageId filtering after restart and reorder', { timeout: 20000 }, async () => {
  const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
  const directory = mkdtempSync(join(tmpdir(), 'hds-p1-labels-'))
  const reserve = createServer()
  await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve))
  const port = (reserve.address() as { port: number }).port
  await new Promise<void>(resolve => reserve.close(() => resolve()))
  const endpoint = 'http://127.0.0.1:1/v1/chat/completions'
  const providers = ['first', 'second'].map(id => ({ id, label: `连接名称${id}`, endpoint, model: id, preset: 'custom', protocol: 'chat-completions' as const, enabled: true, credentialPresent: false, useForMain: true, useForCompaction: true, useForAlter: true }))
  const config: HostConfig = { card: { name: '星禾', description: '测试', personality: '', format: 'v2', warnings: [], raw: {} }, providers, endpoint, model: 'first', modelOptions: { failoverEnabled: false }, token: 'p1-host-test-token-more-than-32-characters', port, dataDir: directory, userName: '我', userProfile: '', autoAdvance: false }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    await host.dispatch('messages.sendLocal', { requestId: 'p1-label-request', content: '测试消息' })
    let trace: DiagnosticMessagesResult | undefined
    for (let n = 0; n < 150; n++) {
      trace = await host.dispatch('diagnostics.messages', { messageId: 'p1-label-request' }) as DiagnosticMessagesResult
      if (trace.events.some(event => event.stage === 'model' && event.outcome === 'failed')) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.ok(trace?.events.some(event => event.providerLabel === '连接名称first'))
    assert.ok(trace!.events.every(event => event.requestIds.includes('p1-label-request')))
    assert.doesNotMatch(readFileSync(join(directory, 'message-diagnostics.json'), 'utf8'), /连接名称/)
    await host.stop(); host = await startHost({ ...config, providers: [...providers].reverse() })
    const restored = await host.dispatch('diagnostics.messages', { messageId: 'p1-label-request' }) as DiagnosticMessagesResult
    assert.ok(restored.events.some(event => event.providerSlot === 1))
    assert.ok(restored.events.every(event => !event.providerLabel))
    assert.equal(diagnosticConnection(restored.events.find(event => event.providerSlot === 1)!), '连接 #1')
  } finally { await host?.stop(); rmSync(directory, { recursive: true, force: true }) }
})
