import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HostConfig } from '../runtime/host'
import type { DiagnosticEvent } from '../packages/contracts/diagnostics'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const listen = (server: ReturnType<typeof createServer>) => new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const close = (server: ReturnType<typeof createServer>) => new Promise<void>(resolve => server.close(() => resolve()))
const until = async (check: () => Promise<boolean>) => { for (let n = 0; n < 300; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 50)) } throw new Error('P0 host fixture timed out') }

async function withHost(reply: (model: string, call: number) => { status?: number; headers?: Record<string, string> }, task: (host: Awaited<ReturnType<typeof startHost>>, calls: string[]) => Promise<void>) {
  const calls: string[] = []
  const model = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk
    const input = JSON.parse(body); calls.push(input.model)
    const result = reply(input.model, calls.length)
    res.writeHead(result.status ?? 200, { 'content-type': 'application/json', ...result.headers })
    res.end(JSON.stringify(result.status ? { error: { message: 'fixture failure' } } : { choices: [{ message: { content: JSON.stringify({ script: '星禾放下书，回复朋友。', interaction: { seen: true, reply: { mode: 'immediate', content: '收到。' } } }) } }] }))
  })
  await listen(model)
  const reserve = createServer(); await listen(reserve); const port = (reserve.address() as { port: number }).port; await close(reserve)
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-p0-host-'))
  const endpoint = `http://127.0.0.1:${(model.address() as { port: number }).port}/v1/chat/completions`
  const providers = ['first', 'second'].map(id => ({ id, label: id, model: id, endpoint, preset: 'custom', protocol: 'chat-completions' as const, enabled: true, useForMain: true, useForCompaction: true, useForAlter: true }))
  const config: HostConfig = { card: { name: '星禾', description: '朋友', personality: '', format: 'v2', warnings: [], raw: {} }, endpoint, model: 'first', providers, modelOptions: { failoverEnabled: true }, mobileConfig: { backgroundLimit: 1 }, userName: '我', userProfile: '', autoAdvance: false, port, token: 'p0-reliability-fixture-token-longer-than-32', dataDir }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try { host = await startHost(config); await task(host, calls) }
  finally { await host?.stop(); await close(model); rmSync(dataDir, { recursive: true, force: true }) }
}
const trace = async (host: Awaited<ReturnType<typeof startHost>>, id: string) => (await host.dispatch('diagnostics.messages', { messageId: id }) as { events: DiagnosticEvent[] }).events

test('P0 built host reports attempt 1/2 for transient 429 and delivers after retry', { timeout: 30000 }, async () => {
  await withHost((_model, call) => call === 1 ? { status: 429, headers: { 'Retry-After': '0' } } : {}, async (host, calls) => {
    const id = 'p0-host-throttled-message'
    await host.dispatch('messages.sendLocal', { requestId: id, content: '你好' })
    await until(async () => (await trace(host, id)).some(event => event.stage === 'delivery' && event.outcome === 'delivered'))
    assert.deepEqual(calls, ['first', 'first'])
    const events = (await trace(host, id)).filter(event => event.stage === 'model')
    assert.deepEqual(events.map(event => [event.outcome, event.attempt, event.providerSlot]), [['started', 1, 1], ['failed', 1, 1], ['started', 2, 1], ['succeeded', 2, 1]])
  })
})

test('P0 model failure fallback avoids duplicates and still records failures before transport on later turns', { timeout: 30000 }, async () => {
  await withHost(model => ({ status: model === 'first' ? 401 : 503 }), async (host, calls) => {
    const id = 'p0-host-all-providers-failed'
    await host.dispatch('messages.sendLocal', { requestId: id, content: '你好' })
    await until(async () => (await trace(host, id)).some(event => event.stage === 'processing' && event.outcome === 'settled'))
    assert.deepEqual(calls, ['first', 'second', 'second'])
    const failures = (await trace(host, id)).filter(event => event.stage === 'model' && event.outcome === 'failed')
    assert.deepEqual(failures.map(event => [event.providerSlot, event.attempt]), [[1, 1], [2, 1], [2, 2]])
    const service = host.app.interlude as any
    service.decide = async () => { throw new Error('pre-transport fixture failure') }
    const next = 'p0-host-before-transport-failure'
    await host.dispatch('messages.sendLocal', { requestId: next, content: '再试一次' })
    await until(async () => (await trace(host, next)).some(event => event.stage === 'processing' && event.outcome === 'settled'))
    const fallback = (await trace(host, next)).filter(event => event.stage === 'model')
    assert.equal(fallback.length, 1); assert.equal(fallback[0].outcome, 'failed')
  })
})

test('P0 actual service marks only user-initiated narrative retries as foreground at exhausted budget', { timeout: 30000 }, async () => {
  await withHost(() => ({}), async (host, calls) => {
    const service = host.app.interlude as any
    const story = (await host.dispatch('story.snapshot', {}) as any).story
    const participant = (await service.participants(story.id))[0]
    service.config.model.mobileBeforeRequest()
    assert.equal((await host.dispatch('config.status', {}) as any).budget.exhausted, true)
    const now = new Date()
    await service.scheduleNarrativeRetry(story.id, participant.id, now)
    const persisted = (await service.adminPendingIntents(story.id, 100)).find((intent: any) => intent.type === 'narrative-retry')
    assert.equal(persisted.payload.userInitiated, true)
    const invoke = (type: string, userInitiated: boolean) => service.decide(story, participant, 'intent-due', now, now, undefined, [{ ...persisted, type, payload: { ...persisted.payload, userInitiated } }])
    assert.equal((await invoke('narrative-retry', true)).script, '星禾放下书，回复朋友。')
    await assert.rejects(invoke('narrative-retry', false), (error: any) => error.code === 'HDS_MOBILE_BUDGET')
    await assert.rejects(invoke('delayed-reply', true), (error: any) => error.code === 'HDS_MOBILE_BUDGET')
    assert.deepEqual(calls, ['first'])
    assert.equal((await host.dispatch('config.status', {}) as any).budget.used, 1)
  })
})
