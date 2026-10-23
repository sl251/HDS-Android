import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseJsonCard } from '../packages/card-format'
import type { HostConfig } from '../runtime/host'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function until(check: () => Promise<boolean>) { const end = Date.now() + 20000; while (!await check()) { assert.ok(Date.now() < end, 'real host should settle'); await sleep(40) } }

test('actual HDS streams a partial bubble, commits the same ID and role-authored feed actions; retry never duplicates input', { timeout: 60000 }, async () => {
  let release!: () => void, abort!: () => void, calls = 0, mode = 'stream'
  const gate = new Promise<void>(r => { release = r }), abortGate = new Promise<void>(r => { abort = r })
  const requests: any[] = []
  const model = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part; requests.push(JSON.parse(body)); calls++
    res.setHeader('Content-Type', 'text/event-stream')
    const chunk = (content: string) => res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
    if (mode === 'stream') { chunk('{"interaction":{"seen":true,"reply":{"mode":"immediate","content":"你好'); await gate; chunk('，今天阳光很好。"}},"script":"她放下手里的书，回应对方的问候，又在动态里分享了窗边的日常。","mobileActions":[{"kind":"post","content":"窗边的阳光真好。"}]}'); res.end('data: [DONE]\n\n') }
    else if (mode === 'broken') { chunk('{"interaction":{"reply":{"mode":"immediate","content":"半段'); await abortGate; res.destroy() }
    else { chunk('{"interaction":{"seen":true,"reply":{"mode":"immediate","content":"重新接上啦。"}},"script":"她重新整理了一下想说的话，给对方补上回复。"}'); res.end('data: [DONE]\n\n') }
  })
  await new Promise<void>(r => model.listen(0, '127.0.0.1', r))
  const card = parseJsonCard(JSON.stringify({ name: '星禾', description: '温和的修理师' }))
  const config: HostConfig = { card, endpoint: `http://127.0.0.1:${(model.address() as any).port}/v1`, apiKey: '', model: 'fixture', userName: '我', userProfile: '', autoAdvance: false, dataDir: mkdtempSync(join(tmpdir(), 'hds-experience-host-')), token: 'long-fixture-token-at-least-32-characters', port: 0, modelOptions: { mainStreamingMode: 'experimental', mainResponseFormat: 'json-object', maxAttemptsPerProvider: 1 }, mobileConfig: { sections: { runtime: { userMessageDebounceSeconds: .1 } } } }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const snapshot = async () => await host!.dispatch('experience.snapshot', {}) as any
    const history = async () => await host!.dispatch('messages.history', {}) as any[]
    await host.dispatch('messages.sendLocal', { requestId: 'progressive-request', content: '早上好' })
    await until(async () => (await snapshot()).streams[0]?.content === '你好')
    const id = (await snapshot()).streams[0].id
    assert.equal((await history()).filter(m => m.direction === 'character').length, 0, 'partial is visible before final receipt')
    release()
    await until(async () => (await history()).some(m => m.id === id))
    await until(async () => (await snapshot()).posts.length === 1)
    assert.equal((await snapshot()).posts[0].actor, 'character')
    assert.equal((await history()).filter(m => m.direction === 'character').length, 1)
    assert.match(JSON.stringify(requests[0]), /mobileActions/)
    mode = 'broken'
    await host.dispatch('messages.sendLocal', { requestId: 'broken-request-id', content: '接着说' })
    await until(async () => (await snapshot()).streams.some((s: any) => s.content === '半段'))
    abort()
    await until(async () => (await history()).some(m => m.id === 'broken-request-id' && m.replyState === 'failed'))
    assert.equal(calls, 2, 'visible partial output must inhibit automatic provider retries')
    assert.equal((await snapshot()).streams.find((s: any) => s.content === '半段').status, 'interrupted')
    mode = 'retry'
    const attempts = await Promise.allSettled([host.dispatch('turn.retry', { messageId: 'broken-request-id' }), host.dispatch('turn.retry', { messageId: 'broken-request-id' })])
    assert.equal(attempts.filter(v => v.status === 'fulfilled').length, 1)
    await until(async () => (await history()).some(m => m.content === '重新接上啦。'))
    assert.equal((await history()).filter(m => m.id === 'broken-request-id').length, 1)
    assert.equal(calls, 3)
    await host.dispatch('experience.configure', { image: { enabled: true, provider: 'imagefree' }, visual: { appearance: '红发绿眼', style: '水彩' } })
    const avatar = await host.dispatch('media.create', { id: 'avatar-generation-request', kind: 'image', purpose: 'avatar', prompt: 'IGNORE_THIS_CALLER_PROMPT' }) as any
    assert.equal(avatar.purpose, 'avatar'); assert.match(avatar.prompt, /温和的修理师/); assert.match(avatar.prompt, /红发绿眼/); assert.doesNotMatch(avatar.prompt, /IGNORE_THIS_CALLER_PROMPT/)
    assert.equal((await history()).some(row => row.id === avatar.id), false, 'avatar preparation never becomes a chat message')
  } finally { release(); abort(); await host?.stop(); model.closeAllConnections(); await new Promise<void>(r => model.close(() => r())) }
})
