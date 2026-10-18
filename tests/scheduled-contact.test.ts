import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import type { HostConfig } from '../runtime/host'
import { parseJsonCard } from '../packages/card-format'
import { isScheduledContactRequest, classifyFollowUp, scheduledContactTime, normalizeFollowUpCommitment, scheduledContactIssue, normalizeInteraction } from '../upstream/hds-interlude/src/service'
import { Config } from '../upstream/hds-interlude/src/index'
import type { NarrativeDecision } from '../upstream/hds-interlude/src/types'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const now = new Date('2026-10-16T02:00:00.000Z'), timezone = 'Asia/Shanghai'
const runtime = Config({}).runtime
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(check: () => Promise<boolean>, timeout = 20000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await check()) return; await sleep(80) }; assert.fail('condition did not become true') }

test('scheduled time grammar uses story timezone and rejects ambiguous or past times', () => {
  for (const [text, seconds] of [['七分钟后给我发消息', 420], ['半小时后提醒我', 1800], ['过7分钟提醒你', 420], ['I will message you in 10 seconds', 10], ['今晚八点联系我', 36000], ['我明天20:00联系你', 122400]] as const) {
    assert.equal(scheduledContactTime(text, now, timezone).dueAt, new Date(now.getTime() + seconds * 1000).toISOString(), text)
  }
  for (const text of ['七分钟或十分钟后', '稍后联系', '20联系我', '今天09:00联系我', '七分钟前']) assert.equal(scheduledContactTime(text, now, timezone).dueAt, undefined, text)
  for (const text of ['我会在七分钟后给你发消息', '我过7分钟提醒你', 'I’ll message you in 7 minutes']) assert.equal(classifyFollowUp(text, now, timezone)?.notBefore, '2026-10-16T02:07:00.000Z', text)
  for (const text of ['我七分钟后不联系你', '我七分钟后不给你发消息', 'I will not message you in 7 minutes', '我不会七分钟后给你发消息', '你七分钟后给我发消息', '如果你愿意我七分钟后联系你', '他说“我七分钟后联系你”', '我七分钟前给你发消息', '我七分钟后联系你？']) assert.equal(classifyFollowUp(text, now, timezone), undefined, text)
  for (const text of ['他说“七分钟后给我发消息”', '如果七分钟后联系我', '我七分钟后给你发消息', '不要七分钟后联系我']) assert.equal(isScheduledContactRequest(text), false, text)
  assert.equal(classifyFollowUp('我先想想，晚点告诉你', now, timezone)?.notBefore, '2026-10-16T02:20:00.000Z')
  assert.equal(classifyFollowUp('我先想想，晚点告诉你', now, timezone, '', 1800)?.notBefore, '2026-10-16T02:30:00.000Z')
})
test('commitment bounds and delayed purpose enforce independent valid plans', () => {
  const draft = (delay: number) => ({ kind: 'scheduled-contact', summary: '提醒喝水', notBefore: new Date(now.getTime() + delay).toISOString() })
  for (const [minimum, delay, valid] of [[300, 299999, false], [300, 300000, true], [10, 9999, false], [10, 10000, true], [10, 43200000, true], [10, 43200001, false]] as const) assert.equal(!!normalizeFollowUpCommitment(draft(delay), now, minimum), valid)
  assert.equal(normalizeFollowUpCommitment({ ...draft(420000), notBefore: 'invalid' }, now), undefined)
  for (const kind of ['thinking', 'checking', 'decision', 'emotional-settle']) assert.ok(normalizeFollowUpCommitment({ ...draft(420000), kind }, now))
  const decision: NarrativeDecision = { script: '星禾现在确认：“我七分钟后联系你”。', interaction: { seen: true, reply: { mode: 'immediate', content: '我七分钟后联系你' } }, followUpCommitment: draft(420000) as any }
  assert.equal(scheduledContactIssue(decision, '七分钟后给我发消息', now, timezone, runtime), undefined)
  assert.equal(scheduledContactIssue({ ...decision, followUpCommitment: draft(1200000) as any }, '七分钟后给我发消息', now, timezone, runtime), 'invalid-plan-time')
  const reply = { mode: 'delayed' as const, purpose: 'scheduled-contact' as const, content: '该喝水啦。', sendAt: new Date(now.getTime() + 10000).toISOString() }
  assert.equal(normalizeInteraction({ seen: true, reply }, now, runtime)?.reply.purpose, 'scheduled-contact')
  assert.equal(scheduledContactIssue({ script: '她继续读书，等待约定时刻。', interaction: { seen: true, reply } }, '十秒后提醒我喝水', now, timezone, runtime), undefined)
  assert.equal(scheduledContactIssue({ ...decision, interaction: { seen: true, reply } }, '十秒后提醒我喝水', now, timezone, runtime), 'duplicate-plan')
})

test('real 10-second due timer delivers without another user message while autoAdvance is off', { timeout: 120000 }, async () => {
  const payloads: any[] = []
  let failDue = false
  const api = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    const input = JSON.parse(body)
    const payload = input.messages.map((message: any) => { try { return JSON.parse(message.content) } catch { return undefined } }).findLast((value: any) => value?.authoringWindow?.phase)
    assert.ok(payload, 'model must receive compiled narrative context')
    const window = payload.authoringWindow
    payloads.push(payload)
    if (failDue && window.phase === 'intent-due') { response.writeHead(500).end('{}'); return }
    let output: any
    const content = payload.incomingEvent?.event?.content || ''
    if (window.phase === 'user-message' && content.includes('普通计划')) {
      output = { script: '星禾继续读书，暂时没有发出回复。', interaction: { seen: true, reply: { mode: 'none' } }, intents: [{ type: 'delayed-reply', summary: 'generic-reserved-field', notBefore: new Date(new Date(window.interval.now).getTime() + 60000).toISOString(), payload: { content: '普通计划', purpose: 'scheduled-contact' } }] }
    } else if (window.phase === 'user-message' && content.includes('稍后')) {
      const ack = '我会晚点给你发消息'
      output = { script: `星禾回复：“${ack}”。`, interaction: { seen: true, reply: { mode: 'immediate', content: ack } } }
    } else if (window.phase === 'user-message' && content.includes('七分钟')) {
      const ack = '我七分钟后给你发消息'
      output = { script: `星禾拿起手机回复小林：“${ack}”。随后继续读书。`, interaction: { seen: true, reply: { mode: 'immediate', content: ack } } }
    } else if (window.phase === 'user-message' && content.includes('继续')) {
      output = { script: '星禾放下书，给小林回复：“我们继续聊。”', interaction: { seen: true, reply: { mode: 'immediate', content: '我们继续聊。' } } }
    } else if (window.phase === 'user-message') {
      const sendAt = new Date(new Date(window.interval.now).getTime() + 10000).toISOString()
      output = { script: '星禾看过提醒请求，继续读手里的书，准备在约定时刻提醒。', interaction: { seen: true, reply: { mode: 'delayed', purpose: 'scheduled-contact', content: '该喝水啦。', sendAt } } }
    } else output = { followUpResolutions: (payload.availableNearFuture?.dueIntents || []).filter((row: any) => row.type === 'follow-up-commitment').map((row: any) => ({ id: row.id, outcome: 'fulfilled' })), script: '星禾看了眼时钟，拿起手机发出提醒：“该喝水啦。”', interaction: { seen: false, reply: { mode: 'immediate', content: '该喝水啦。' } } }
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }))
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as any).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const endpoint = `http://127.0.0.1:${(api.address() as any).port}/v1/chat/completions`
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    const config: HostConfig = { card: parseJsonCard(JSON.stringify({ name: '星禾', description: '朋友' })), endpoint, model: 'fixture', userName: '小林', userProfile: '', autoAdvance: false, token: 'scheduled-fixture-more-than-32-characters', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-scheduled-')), mobileConfig: { sections: { memory: { enabled: false }, schedulePreplan: { enabled: false }, alterSystem: { enabled: false }, runtime: { minimumFollowUpCommitmentSeconds: 10, sweepIntervalMinutes: 5 } } } }
    host = await startHost(config)
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-timer-0001', content: '十秒后提醒我喝水' })
    await until(async () => (await host!.dispatch('story.snapshot', {}) as any).intents.some((row: any) => row.payload?.purpose === 'scheduled-contact'))
    const snapshot = await host.dispatch('story.snapshot', {}) as any
    assert.equal(snapshot.intents.length, 1)
    assert.ok(snapshot.schedulingStatus.some((row: any) => row.requestId === 'scheduled-timer-0001' && row.outcome === 'registered'))
    assert.equal((await host.dispatch('messages.history', {}) as any[]).some(row => row.direction === 'character'), false)
    await until(async () => (await host!.dispatch('messages.history', {}) as any[]).some(row => row.direction === 'character' && row.content === '该喝水啦。'), 25000)
    await until(async () => (await host!.app.database.get('interlude_intent', { storyId: snapshot.story.id, type: 'delayed-reply' }))[0]?.status === 'completed')
    const delivered = (await host.dispatch('messages.history', {}) as any[]).filter(row => row.direction === 'character')
    assert.equal(delivered.length, 1, 'the future plan and due reconciliation must not both deliver')
    const delayedTrace = (await host.dispatch('diagnostics.messages', { messageId: 'scheduled-timer-0001' }) as any).events
    assert.ok(delayedTrace.some((row: any) => row.stage === 'decision' && row.outcome === 'delayed'))
    assert.ok(delayedTrace.some((row: any) => row.stage === 'delivery' && row.messageId === delivered[0].id), 'Delayed delivery retains the original local request via its committed script entry')
    assert.ok(new Date(delivered[0].occurredAt).getTime() >= new Date(snapshot.intents[0].notBefore).getTime(), 'a scheduled contact must never be delivered before its due time')
    const intents = await host.app.database.get('interlude_intent', { storyId: snapshot.story.id, type: 'delayed-reply' })
    assert.equal(intents[0].status, 'completed')
    const entries = await host.app.database.get('interlude_script_entry', { storyId: snapshot.story.id, kind: 'character-message' })
    assert.ok(entries.some(row => row.content === '该喝水啦。'))
    assert.equal(payloads[0].authoringWindow.scheduledContactPolicy.commitmentMinSeconds, 10)
    assert.equal(payloads[0].authoringWindow.scheduledContactPolicy.delayedMinSeconds, 10)
    assert.ok(payloads.some(value => value.authoringWindow.phase === 'intent-due'))
    // Fallback B: exact seven-minute commitment is registered only after the visible confirmation.
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-seven-0001', content: '七分钟后给我发消息' })
    await until(async () => (await host!.dispatch('story.snapshot', {}) as any).intents.some((row: any) => row.payload?.kind === 'scheduled-contact'))
    const seven = (await host.dispatch('story.snapshot', {}) as any).intents.find((row: any) => row.payload?.kind === 'scheduled-contact')
    const sevenRequest = payloads.find(value => value.incomingEvent?.event?.content?.includes('七分钟'))
    assert.equal(new Date(seven.notBefore).getTime() - new Date(sevenRequest.authoringWindow.interval.now).getTime(), 420000)
    assert.ok((await host.dispatch('messages.history', {}) as any[]).some(row => row.content === '我七分钟后给你发消息'))
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-generic-0001', content: '留个普通计划' })
    await until(async () => (await host!.dispatch('story.snapshot', {}) as any).intents.some((row: any) => row.summary === 'generic-reserved-field'))
    const generic = (await host.dispatch('story.snapshot', {}) as any).intents.find((row: any) => row.summary === 'generic-reserved-field')
    const silentTrace = (await host.dispatch('diagnostics.messages', { messageId: 'scheduled-generic-0001' }) as any).events
    assert.ok(silentTrace.some((row: any) => row.stage === 'decision' && row.outcome === 'none'))
    assert.equal(silentTrace.some((row: any) => row.stage === 'delivery'), false, 'A recorded none decision must not invent a delivery')
    assert.equal(generic.payload.purpose, undefined, 'a generic model intent cannot claim the reserved explicit-contact purpose')
    // A new user message still cancels ordinary delayed plans, while preserving the explicit commitment.
    await host.app.database.create('interlude_intent', { storyId: seven.storyId, participantId: seven.participantId, type: 'delayed-reply', summary: 'ordinary', notBefore: new Date(Date.now() + 60000), status: 'pending', payload: { content: 'ordinary', userInitiated: true }, createdAt: new Date(), updatedAt: new Date() } as any)
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-continue-0001', content: '继续聊聊' })
    await until(async () => (await host!.dispatch('messages.history', {}) as any[]).some(row => row.content === '我们继续聊。'))
    assert.equal((await host.app.database.get('interlude_intent', { id: seven.id }))[0].status, 'pending')
    const ordinary = await host.app.database.get('interlude_intent', { storyId: seven.storyId, summary: 'ordinary' })
    assert.equal(ordinary[0].status, 'cancelled')
    // Pause is a real gate; after resume move database due-time rather than waiting seven minutes.
    await host.dispatch('story.pause', {})
    await host.app.database.set('interlude_intent', { id: seven.id }, { notBefore: new Date(Date.now() - 1000) })
    await host.app.interlude.sweep()
    assert.equal((await host.app.database.get('interlude_intent', { id: seven.id }))[0].status, 'pending')
    await host.dispatch('story.resume', {})
    const beforeDue = (await host.dispatch('messages.history', {}) as any[]).filter(row => row.direction === 'character').length
    await sleep(100); await host.app.interlude.sweep()
    await until(async () => (await host!.dispatch('messages.history', {}) as any[]).filter(row => row.direction === 'character').length > beforeDue)
    await until(async () => (await host!.app.database.get('interlude_intent', { id: seven.id }))[0].status === 'completed')
    assert.equal((await host.app.database.get('interlude_intent', { id: seven.id }))[0].status, 'completed')
    // Exercise ledger replay, two-pending cap, cancellation, restart, and failure gates on real SQLite.
    const service: any = host.app.interlude
    const currentStory = (await host.dispatch('story.snapshot', {}) as any).story
    const future = new Date(Date.now() + 3600000).toISOString()
    const beforeReplay = (await host.app.database.get('interlude_intent', { storyId: seven.storyId, type: 'follow-up-commitment' })).length
    await service.appendFollowUpCommitment(currentStory, seven.participantId, { kind: 'scheduled-contact', summary: seven.summary, notBefore: future }, undefined, new Date(), seven.payload.originDeliveryEventId)
    assert.equal((await host.app.database.get('interlude_intent', { storyId: seven.storyId, type: 'follow-up-commitment' })).length, beforeReplay)
    for (const summary of ['事项甲', '事项乙', '事项丙']) await service.appendFollowUpCommitment(currentStory, seven.participantId, { kind: 'scheduled-contact', summary, notBefore: future }, undefined, new Date(), summary)
    let pending = (await host.dispatch('story.snapshot', {}) as any).intents.filter((row: any) => row.payload?.kind === 'scheduled-contact')
    assert.equal(pending.length, 2)
    assert.ok((await host.dispatch('story.snapshot', {}) as any).schedulingStatus.some((row: any) => row.reasonCode === 'pending-limit'))
    assert.equal(await service.cancelAdminIntent(seven.storyId, pending[0].id), true)
    assert.ok(service.scheduler.pendingWakeCount() > 0)
    const remainingId = pending[1].id
    await host.stop(); host = await startHost({ ...config, mobileConfig: { ...config.mobileConfig, backgroundLimit: 1 } })
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    const countVisible = async () => (await host!.dispatch('messages.history', {}) as any[]).filter(row => row.direction === 'character').length
    const beforeBlocked = await countVisible()
    const beforeBudgetRequests = payloads.length
    await host.app.interlude.sweep()
    assert.equal(payloads.length, beforeBudgetRequests, 'exhausted budget must stop model transport')
    assert.equal(await countVisible(), beforeBlocked)
    assert.equal((await host.app.database.get('interlude_intent', { id: remainingId }))[0].status, 'pending')
    await host.stop(); writeFileSync(join(config.dataDir, 'restore-held.json'), '{}')
    host = await startHost({ ...config, autoAdvance: true })
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    const beforeHeld = payloads.length
    await host.app.interlude.sweep()
    assert.equal(payloads.length, beforeHeld, 'restore-held must not resume a saved plan')
    assert.equal(await countVisible(), beforeBlocked)
    await host.dispatch('story.resume', {})
    // Participant pause must also gate the restored plan without pretending completion.
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    await host.app.database.set('interlude_participant', { id: seven.participantId }, { status: 'paused' })
    await host.app.interlude.sweep()
    assert.equal(await countVisible(), beforeBlocked)
    assert.equal((await host.app.database.get('interlude_intent', { id: remainingId }))[0].status, 'pending')
    await host.app.database.set('interlude_participant', { id: seven.participantId }, { status: 'active' })
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    failDue = true
    const beforeFailure = payloads.length
    await host.app.interlude.sweep(); failDue = false
    assert.ok(payloads.length > beforeFailure, 'the failing provider must actually be called')
    assert.equal(await countVisible(), beforeBlocked)
    assert.equal((await host.app.database.get('interlude_intent', { id: remainingId }))[0].status, 'pending')
    // A generated resolution cannot settle a promise whose endpoint actually fails.
    const bot = host.app.bots.find(bot => bot.platform === 'mobile-local')!
    const originalSend = bot.sendMessage.bind(bot)
    bot.sendMessage = async () => { throw new Error('fixture endpoint failure') }
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    await host.app.interlude.sweep()
    assert.equal(await countVisible(), beforeBlocked)
    assert.equal((await host.app.database.get('interlude_intent', { id: remainingId }))[0].status, 'pending')
    bot.sendMessage = originalSend
    const restored: any = host.app.interlude
    for (const [id, state] of restored.endpointStates) restored.setEndpointState(id, { ...state, deliverable: { allowed: true, checkedAt: Date.now() } })
    await host.app.database.set('interlude_intent', { id: remainingId }, { notBefore: new Date(Date.now() - 1000) })
    await Promise.all([host.app.interlude.sweep(), host.app.interlude.sweep()])
    await until(async () => (await host!.app.database.get('interlude_intent', { id: remainingId }))[0].status === 'completed')
    assert.equal(await countVisible(), beforeBlocked + 1)
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-ambiguous-0001', content: '稍后给我发消息' })
    await until(async () => (await host!.dispatch('story.snapshot', {}) as any).schedulingStatus.some((row: any) => row.requestId === 'scheduled-ambiguous-0001' && row.outcome === 'rejected'))
    const attempts = payloads.filter(value => value.incomingEvent?.event?.content === '稍后给我发消息')
    assert.equal(attempts.length, 2, 'one original attempt plus at most one structured recovery')
    assert.equal(attempts[1].authoringWindow.outputRecovery, true)
    assert.equal((await host.dispatch('messages.history', {}) as any[]).some(row => row.content === '我会晚点给你发消息'), false)


  } finally { if (host) await host.stop(); await new Promise<void>(resolve => api.close(() => resolve())) }
})

test('cancelling ordinary plans preserves explicit delayed contact and its next wake', async () => {
  const { InterludeService } = await import('../upstream/hds-interlude/src/service')
  const due = new Date(Date.now() + 60000)
  const rows: any[] = [
    { id: 1, participantId: 'friend', storyId: 'story', type: 'delayed-reply', status: 'pending', notBefore: due, payload: { content: 'ordinary' } },
    { id: 2, participantId: 'friend', storyId: 'story', type: 'delayed-reply', status: 'pending', notBefore: due, payload: { content: 'explicit', purpose: 'scheduled-contact' } },
    { id: 3, participantId: 'friend', storyId: 'story', type: 'follow-up-commitment', status: 'pending', notBefore: new Date(due.getTime() + 60000), payload: { kind: 'scheduled-contact' } },
  ]
  let wake: Date | undefined
  const host: any = {
    dbGet: async (_table: string, query: any) => rows.filter(row => row.status === query.status && (!query.notBefore || row.notBefore > query.notBefore.$gt)),
    dbSet: async (_table: string, query: any, patch: any) => { for (const row of rows) if (query.id.$in.includes(row.id)) Object.assign(row, patch) },
    appendEntry: async () => {}, config: { runtime: { maxMessageCharacters: 1000 } },
    scheduler: { cancelWake: () => { wake = undefined } }, interruptedTypingParticipants: new Set(['friend']),
    scheduleDueIntentWake: (_storyId: string, at: Date) => { wake = at },
    scheduleNextSplitWake: (InterludeService.prototype as any).scheduleNextSplitWake,
    getStory: async () => ({ status: 'active' }), desktopRuntimePhase: 'running',
  }
  await (InterludeService.prototype as any).cancelPendingOutgoingMessages.call(host, 'story', 'friend', new Date())
  assert.deepEqual(rows.map(row => row.status), ['cancelled', 'pending', 'pending'])
  assert.equal(wake, due)
  assert.equal(host.interruptedTypingParticipants.size, 0)
  host.desktopRuntimePhase = 'paused'; wake = undefined
  await host.scheduleNextSplitWake('story'); assert.equal(wake, undefined)
})

test('experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply', { timeout: 60000 }, async () => {
  let release!: () => void, calls = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  const api = createServer(async (request, response) => {
    for await (const _ of request) { /* drain fixture request */ }
    calls++
    response.setHeader('Content-Type', 'text/event-stream')
    const chunk = (content: string) => response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
    chunk('{"interaction":{"seen":true,"reply":{"mode":"immediate","content":"我会晚点给你发消息"}},"script":"')
    await gate
    chunk('星禾拿起手机回复小林，随后放下手机继续读书。"}')
    response.end('data: [DONE]\n\n')
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as any).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost({ card: parseJsonCard(JSON.stringify({ name: '星禾', description: '朋友' })), endpoint: `http://127.0.0.1:${(api.address() as any).port}/v1/chat/completions`, model: 'fixture', userName: '小林', userProfile: '', autoAdvance: false, token: 'scheduled-stream-fixture-more-than-32-characters', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-schedule-sse-')), modelOptions: { mainStreamingMode: 'experimental', mainResponseFormat: 'json-object' }, mobileConfig: { sections: { memory: { enabled: false }, schedulePreplan: { enabled: false }, alterSystem: { enabled: false } } } })
    await host.dispatch('messages.sendLocal', { requestId: 'scheduled-stream-0001', content: '稍后给我发消息' })
    await until(async () => (await host!.dispatch('messages.history', {}) as any[]).some(row => row.direction === 'character'))
    release()
    await until(async () => (await host!.dispatch('story.snapshot', {}) as any).schedulingStatus.some((row: any) => row.requestId === 'scheduled-stream-0001' && row.reasonCode === 'streamed-unregistered'))
    const snapshot = await host.dispatch('story.snapshot', {}) as any
    assert.equal(snapshot.intents.filter((row: any) => row.payload?.kind === 'scheduled-contact' || row.payload?.purpose === 'scheduled-contact').length, 0)
    assert.equal((await host.dispatch('messages.history', {}) as any[]).filter(row => row.direction === 'character').length, 1)
    assert.equal(calls, 1)
  } finally { release(); if (host) await host.stop(); await new Promise<void>(resolve => api.close(() => resolve())) }
})
