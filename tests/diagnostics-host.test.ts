import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HostConfig } from '../runtime/host'
import type { DiagnosticEvent } from '../packages/contracts/diagnostics'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const listen = (server: ReturnType<typeof createServer>) => new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const close = (server: ReturnType<typeof createServer>) => new Promise<void>(resolve => server.close(() => resolve()))
const until = async (check: () => Promise<boolean>) => { for (let n = 0; n < 200; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 50)) } throw new Error('diagnostic fixture timed out') }

for (const status of [401, 402, 403, 429]) test(`actual model ${status} explicit rejection skips same-provider retries and uses configured fallback`, { timeout: 30000 }, async () => {
  const calls: string[] = []
  const model = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk
    const input = JSON.parse(body); calls.push(input.model)
    res.setHeader('Content-Type', 'application/json')
    if (input.model === 'rejected') { res.statusCode = status; res.end(JSON.stringify({ error: { code: status === 429 ? 'insufficient_quota' : 'rejected', message: 'PRIVATE_ERROR_TEXT sk-fixture' } })); return }
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾看完消息，继续手上的工作。', interaction: { seen: true, reply: { mode: 'immediate', content: '收到。' } } }) } }] }))
  })
  await listen(model)
  const reserve = createServer(); await listen(reserve); const port = (reserve.address() as { port: number }).port; await close(reserve)
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-rejection-'))
  const endpoint = `http://127.0.0.1:${(model.address() as { port: number }).port}/v1/chat/completions`
  const providers = ['rejected', 'fallback'].map(id => ({ id, label: `PRIVATE_LABEL_${id}`, model: id, endpoint, preset: 'custom', protocol: 'chat-completions' as const, enabled: true, useForMain: true, useForCompaction: true, useForAlter: true }))
  const config: HostConfig = { card: { name: '星禾', description: 'PRIVATE_PERSONA', personality: '', format: 'v2', warnings: [], raw: {} }, endpoint, model: 'rejected', providers, modelOptions: { mainStreamingMode: 'off', failoverEnabled: true, failoverStrategy: 'priority' }, userName: '我', userProfile: '', autoAdvance: false, port, token: 'diagnostics-fixture-private-token-longer-than-32', dataDir }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const requestId = `rejected-request-${status}`
    await host.dispatch('messages.sendLocal', { requestId, content: 'PRIVATE_MESSAGE' })
    const trace = async () => (await host!.dispatch('diagnostics.messages', { messageId: requestId }) as { events: DiagnosticEvent[] }).events
    await until(async () => (await trace()).some(event => event.stage === 'processing' && event.outcome === 'settled'))
    assert.deepEqual(calls, ['rejected', 'fallback'])
    const events = await trace()
    assert.ok(events.some(event => event.stage === 'model' && event.outcome === 'failed' && event.providerSlot === 1 && event.reason === (status === 401 ? 'authentication' : status === 403 ? 'permission' : 'provider_quota')))
    assert.ok(events.some(event => event.stage === 'model' && event.outcome === 'succeeded' && event.providerSlot === 2))
    assert.ok(events.some(event => event.stage === 'delivery' && event.outcome === 'delivered'))
    assert.doesNotMatch(readFileSync(join(dataDir, 'message-diagnostics.json'), 'utf8'), /PRIVATE|sk-fixture|127\.0\.0\.1/)
    await host.dispatch('messages.sendLocal', { requestId, content: 'PRIVATE_MESSAGE' })
    await host.stop(); host = await startHost(config)
    assert.equal((await trace()).some(event => event.outcome === 'interrupted'), false)
  } finally { await host?.stop(); await close(model); rmSync(dataDir, { recursive: true, force: true }) }
})
