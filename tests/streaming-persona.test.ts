import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import type { HostConfig } from '../runtime/host'
import { parsePersona, editPersona } from '../packages/persona-format'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test('native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history', { timeout: 90000 }, async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let completed = false
  const requests: any[] = []
  const model = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body))
    response.setHeader('Content-Type', 'text/event-stream')
    const chunk = (content: string) => response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
    chunk('{"interaction":{"seen":true,"reply":{"mode":"immediate","content":"收到啦，明天来修理铺吧。"}},"script":"')
    await gate
    chunk('星禾正坐在修理铺里整理旧收音机，看到小林的消息便回复让他明天过来。她放下手机，继续对照手册寻找损坏的零件。"}')
    response.end('data: [DONE]\n\n'); completed = true
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve))
  const portServer = createServer(); await new Promise<void>(resolve => portServer.listen(0, '127.0.0.1', resolve))
  const port = (portServer.address() as { port: number }).port
  await new Promise<void>(resolve => portServer.close(() => resolve()))
  const card = parsePersona(new TextEncoder().encode(JSON.stringify({ storyDefaults: { characterName: '星禾', characterProfile: '修理收音机 NATIVE_PROFILE', world: '海边 WORLD_MARKER', location: '修理铺 LOCATION_MARKER', relationship: '老朋友 RELATION_MARKER', perspectives: ['PERSPECTIVE_MARKER'], userProfile: '邻居 IMPORTED_USER' } })))[0]
  const config: HostConfig = { card, endpoint: `http://127.0.0.1:${(model.address() as { port: number }).port}/v1/chat/completions`, model: 'fixture', apiKey: '', userName: '小林', userProfile: '', autoAdvance: false, token: 'fixture-token-with-more-than-32-characters', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-native-sse-')), modelOptions: { mainStreamingMode: 'experimental', mainResponseFormat: 'json-object' } }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    await host.dispatch('messages.sendLocal', { requestId: 'stream-fixture-001', content: '明天方便来修收音机吗？' })
    const deadline = Date.now() + 25000
    let history: any[] = []
    while (Date.now() < deadline) {
      history = await host.dispatch('messages.history', {}) as any[]
      if (history.some(row => row.direction === 'character')) break
      await sleep(100)
    }
    assert.equal(requests[0]?.stream, true)
    for (const marker of ['NATIVE_PROFILE', 'WORLD_MARKER', 'LOCATION_MARKER', 'RELATION_MARKER', 'PERSPECTIVE_MARKER', 'IMPORTED_USER']) assert.match(JSON.stringify(requests[0]), new RegExp(marker))
    assert.equal(completed, false, 'Reply must be visible while SSE is still open')
    assert.equal(history.filter(row => row.direction === 'character').length, 1)
    assert.equal(history.find(row => row.direction === 'character').content, '收到啦，明天来修理铺吧。')
    const before = await host.dispatch('story.snapshot', {}) as any
    release()
    await host.stop(); host = undefined
    const edited = editPersona(card, { ...card, name: '星禾改名', description: '修改档案 EDITED_PROFILE', hds: { storyDefaults: { ...card.hds!.storyDefaults, relationship: '', perspectives: [], userProfile: '修改用户 EDITED_USER' } } })
    edited.revision = 1
    host = await startHost({ ...config, card: edited })
    const snapshot = await host.dispatch('story.snapshot', {}) as any
    assert.equal(snapshot.story.setting.character.name, '星禾改名')
    assert.equal(snapshot.story.setting.character.profile, '修改档案 EDITED_PROFILE')
    assert.equal(snapshot.story.setting.relationship, '')
    assert.deepEqual(snapshot.story.setting.perspectives, [])
    assert.equal(snapshot.story.setting.user.profile, '修改用户 EDITED_USER')
    assert.equal(snapshot.story.setting.user.displayName, before.story.setting.user.displayName)
    history = await host.dispatch('messages.history', {}) as any[]
    assert.equal(history.filter(row => row.direction === 'user').length, 1)
    assert.equal(history.filter(row => row.direction === 'character').length, 1, 'Final stream completion must not duplicate early delivery')
  } catch (error) { console.error(error); throw error } finally { release(); if (host) await host.stop(); model.closeAllConnections(); await new Promise<void>(resolve => model.close(() => resolve())) }
})
