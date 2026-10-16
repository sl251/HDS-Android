import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { HostConfig } from '../runtime/host'
import { createRequire } from 'node:module'
const { Logger } = createRequire(import.meta.url)('koishi') as typeof import('koishi')
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
import { parseJsonCard } from '../packages/card-format'

test('real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC', { timeout: 90000 }, async () => {
  const logs: string[] = []
  const target = { record: (record: { name: string; content: string }) => { if (record.name === 'hds-interlude') logs.push(record.content) } }
  Logger.targets.push(target)
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
    assert.equal(host.app.interlude.config.logging.level, 'info')
    assert.equal(host.app.interlude.config.logging.verbosity, 'standard')
    assert.equal(host.app.interlude.config.logging.logMessageContent, false)
    assert.equal(host.app.interlude.config.logging.logScriptPreview, false)
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
    // Exercise the real RPC/database projection, including a page boundary with
    // equal timestamps (strict > must not drop a second message in the same ms).
    const base = '2099-01-01T00:00:00.000Z'
    const fixtures = [
      { id: 'since-equal', direction: 'character', content: '相等', occurredAt: base },
      { id: 'since-user', direction: 'user', content: '用户', occurredAt: '2099-01-01T00:00:01Z' },
      { id: 'since-a', direction: 'character', content: '长'.repeat(45) + '\n第二行', occurredAt: '2099-01-01T00:00:01Z' },
      { id: 'since-b', direction: 'character', content: '<img src="x"/>', occurredAt: '2099-01-01T00:00:01Z' },
      { id: 'since-c', direction: 'character', content: '稍后', occurredAt: '2099-01-01T00:00:02Z' },
    ]
    for (const row of fixtures) await host.app.database.create('mobile_message' as never, { ...row, occurredAt: new Date(row.occurredAt), status: 'delivered', images: [] } as never)
    const sinceRows = await host.dispatch('messages.since', { since: base, limit: 1 }) as { id: string; content: string; fullContent: string; occurredAt: string }[]
    assert.deepEqual(sinceRows.map(row => row.id), ['since-a', 'since-b'])
    assert.equal(sinceRows[0].content, '长'.repeat(40))
    assert.equal(sinceRows[0].fullContent, '长'.repeat(45) + '\n第二行')
    assert.equal(sinceRows[1].content, '[图片]')
    assert.deepEqual((await host.dispatch('messages.since', { since: sinceRows[1].occurredAt }) as { id: string }[]).map(row => row.id), ['since-c'])
    await assert.rejects(() => host!.dispatch('messages.since', { since: 'invalid' }))
    for (const row of fixtures) await host.app.database.remove('mobile_message' as never, { id: row.id } as never)

    const pushes: string[] = []
    const write = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array, ...args: any[]) => {
      if (String(chunk).startsWith('HDS_MSG_PUSH ')) pushes.push(String(chunk))
      return (write as any)(chunk, ...args)
    }) as typeof process.stdout.write
    try {
      const [id] = await host.bot.sendMessage('private:local-user', '<img src="x"/>')
      assert.equal(pushes.length, 1)
      const pushed = JSON.parse(pushes[0].slice(13))
      assert.equal(pushed.id, id); assert.equal(pushed.content, '[图片]')
      const saved = (await host.app.database.get('mobile_message' as never, { id } as never))[0] as { occurredAt: Date }
      assert.equal(pushed.occurredAt, saved.occurredAt.toISOString())
      await assert.rejects(() => host!.bot.sendMessage('unauthorized', '无权限'))
      assert.equal(pushes.length, 1, 'No stdout push without successful authorized persistence')
    } finally { process.stdout.write = write }
    assert.match(logs.join('\n'), /模型调用开始/)
    assert.doesNotMatch(logs.join('\n'), /MARKER_PROFILE|EXAMPLE_MARKER|LORE_MARKER/)
    await host.stop(); host = undefined
    host = await startHost(config)
    const repeated = await host.dispatch('messages.sendLocal', message) as { duplicate: boolean }; assert.equal(repeated.duplicate, true)
    assert.equal((await host.dispatch('messages.history', {}) as { direction: string }[]).filter(row => row.direction === 'user').length, 1)
  } finally { Logger.targets.splice(Logger.targets.indexOf(target), 1); if (host) await host.stop(); await new Promise<void>(resolve => model.close(() => resolve())) }
})
