import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { parseJsonCard } from '../packages/card-format'
import { mobileModelConfig } from '../runtime/model-config'
import type { ModelProvider } from '../packages/contracts'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const provider = (id: string, endpoint: string, main: boolean): ModelProvider => ({ id, endpoint, model: id, preset: 'custom', label: id, protocol: 'chat-completions', enabled: true, imageInput: 'supported', credentialPresent: false, useForMain: main, useForCompaction: main, useForAlter: main })

test('vision routing rejects missing or disabled dedicated models', () => {
  const input = { endpoint: '', model: '', providers: [provider('writer', 'https://example.com/v1', true)], modelOptions: { visionEnabled: true, visionProviderId: 'eyes' } }
  assert.throws(() => mobileModelConfig(input), /识图连接/)
  input.providers.push({ ...provider('eyes', 'https://example.com/v1', false), enabled: false })
  assert.throws(() => mobileModelConfig(input), /识图连接/)
  input.providers[1].enabled = true
  const config = mobileModelConfig(input)
  assert.equal(config.vision?.mode, 'sidecar')
  assert.equal(config.providers.filter(row => row.useForVision).length, 1)
})

test('dedicated vision feeds observations to text narration; memory management respects story scope and confirmation', { timeout: 90000 }, async () => {
  const requests: any[] = []
  const model = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    const data = JSON.parse(body); requests.push(data)
    const content = data.model === 'eyes' ? '1. VISUAL_EVIDENCE_7：图片中左侧是绿色，右侧是黄色。' : JSON.stringify({ script: '星禾看了小林发来的图片，放下书回复他。', interaction: { seen: true, reply: { mode: 'immediate', content: '我看到了绿色和黄色。' } } })
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ choices: [{ message: { content } }] }))
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as { port: number }).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const endpoint = `http://127.0.0.1:${(model.address() as { port: number }).port}/v1/chat/completions`
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost({ card: parseJsonCard(JSON.stringify({ name: '星禾', description: '小林的邻居' })), model: 'writer', endpoint, providers: [provider('writer', endpoint, true), provider('eyes', endpoint, false)], modelOptions: { visionEnabled: true, visionProviderId: 'eyes' }, userName: '小林', userProfile: '', autoAdvance: false, token: 'preview-seven-test-token-at-least-32-chars', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-seven-')) })
    const image = await host.dispatch('images.upload', { dataUri: `data:image/jpeg;base64,${readFileSync('fixtures/images/vision-fixture.jpg').toString('base64')}` }) as { id: string }
    await host.dispatch('messages.sendLocal', { requestId: 'sidecar-seven-0001', content: '什么颜色？', images: [image.id] })
    const deadline = Date.now() + 30000
    while (!requests.some(row => row.model === 'writer') && Date.now() < deadline) await sleep(100)
    const vision = requests.find(row => row.model === 'eyes'), writer = requests.find(row => row.model === 'writer')
    assert.ok(vision && writer, 'Both configured models must actually be called')
    assert.match(JSON.stringify(vision), /data:image\/jpeg;base64/)
    assert.doesNotMatch(JSON.stringify(writer), /data:image\/jpeg;base64/)
    assert.match(JSON.stringify(writer), /VISUAL_EVIDENCE_7/)
    while (!(await host.dispatch('messages.history', {}) as any[]).some(row => row.direction === 'character') && Date.now() < deadline) await sleep(100)
    const run = async (kind: string, payload: Record<string, unknown> = {}) => {
      const requestId = crypto.randomUUID()
      await host!.dispatch('maintenance.start', { requestId, kind, ...payload })
      for (let i = 0; i < 100; i++) { const job = await host!.dispatch('maintenance.status', { requestId }) as any; if (job.status !== 'running') return job; await sleep(50) }
      throw new Error('Maintenance did not complete')
    }
    assert.equal((await run('fact-add', { scope: 'character', content: '小林是一位修理师。' })).status, 'done')
    const snapshot = await host.dispatch('story.snapshot', {}) as any
    const fact = snapshot.facts.find((row: any) => row.content.includes('修理师'))
    assert.ok(fact)
    assert.equal((await run('fact-forget', { id: fact.id })).status, 'done')
    assert.equal((await host.dispatch('memory.facts', {}) as any[]).some(row => row.id === fact.id), false)
    const intent = await host.app.database.create('interlude_intent', { storyId: snapshot.story.id, summary: '明天一起修理收音机', status: 'pending', type: 'promise', notBefore: new Date(Date.now() + 86400000) } as never)
    assert.equal((await run('intent-cancel', { id: intent.id })).status, 'failed', 'Unconfirmed mutations must not run')
    assert.equal((await run('intent-cancel', { id: intent.id, confirm: true })).status, 'done')
    assert.equal((await host.app.database.get('interlude_intent', { id: intent.id }))[0].status, 'cancelled')
    const before = await host.dispatch('messages.history', {}) as any[]
    assert.equal((await run('overlay-clear', { target: 'all' })).status, 'failed')
    assert.equal((await run('overlay-clear', { target: 'all', confirm: true })).status, 'done')
    assert.deepEqual((await host.dispatch('messages.history', {}) as any[]).map(row => row.id), before.map(row => row.id), 'Clearing evolution must preserve chat history')
    assert.equal((await run('intent-cancel', { id: intent.id, confirm: true })).status, 'failed', 'Already cancelled intent must not report a new success')
  } finally { if (host) await host.stop(); await new Promise<void>(resolve => model.close(() => resolve())) }
})
