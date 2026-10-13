import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { HostConfig } from '../runtime/host'
import { createRequire } from 'node:module'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
import { parseJsonCard } from '../packages/card-format'

test('real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC', { timeout: 90000 }, async () => {
  const requests: Record<string, unknown>[] = []
  const model = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body))
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾看了眼桌上正在修理的旧收音机。她把螺丝刀放在一旁，拿起手机给小林回复了消息：“收音机我看过了，明天带来吧。”', interaction: { seen: true, reply: { mode: 'immediate', content: '收音机我看过了，明天带来吧。' } } }) } }] }))
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve))
  const portServer = createServer(); await new Promise<void>(resolve => portServer.listen(0, '127.0.0.1', resolve)); const port = (portServer.address() as { port: number }).port; await new Promise<void>(resolve => portServer.close(() => resolve()))
  const config: HostConfig = { card: parseJsonCard(JSON.stringify({ spec: 'chara_card_v2', data: { name: '星禾', description: '角色设定 MARKER_PROFILE', mes_example: 'EXAMPLE_MARKER', creator_notes: 'NOT_A_FACT', character_book: { entries: [{ enabled: true, keys: ['收音机'], content: 'LORE_MARKER' }] } } })), endpoint: `http://127.0.0.1:${(model.address() as { port: number }).port}/chat/completions`, model: 'fixed-fixture', apiKey: '', userName: '小林', userProfile: '邻居', autoAdvance: false, token: 'test-token-with-more-than-32-characters', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-mobile-')) }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const rejected = await fetch(`http://127.0.0.1:${port}/rpc`, { method: 'POST', body: '{"method":"health"}' }); assert.equal(rejected.status, 401)
    assert.equal((await host.dispatch('health', {})).platform, 'mobile-local')
    const message = { requestId: 'fixture-request-0001', content: '收音机坏了' }
    await host.dispatch('messages.sendLocal', message)
    await host.dispatch('messages.sendLocal', message)
    const deadline = Date.now() + 30000
    while (!requests.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200))
    assert.ok(requests.length, 'HDS must actually call the fixed model provider')
    const body = JSON.stringify(requests[0])
    assert.match(body, /MARKER_PROFILE/); assert.match(body, /EXAMPLE_MARKER/); assert.match(body, /LORE_MARKER/); assert.doesNotMatch(body, /NOT_A_FACT/)
    while (Date.now() < deadline) { const history = await host.dispatch('messages.history', {}) as { direction: string }[]; if (history.some(row => row.direction === 'character')) break; await new Promise(resolve => setTimeout(resolve, 200)) }
    const history = await host.dispatch('messages.history', {}) as { direction: string }[]
    assert.equal(history.filter(row => row.direction === 'user').length, 1)
    assert.ok(history.some(row => row.direction === 'character'), 'A model fixture is only useful if HDS confirms visible local delivery')
    await host.stop(); host = undefined
    host = await startHost(config)
    const repeated = await host.dispatch('messages.sendLocal', message) as { duplicate: boolean }; assert.equal(repeated.duplicate, true)
    assert.equal((await host.dispatch('messages.history', {}) as { direction: string }[]).filter(row => row.direction === 'user').length, 1)
  } finally { if (host) await host.stop(); await new Promise<void>(resolve => model.close(() => resolve())) }
})
