import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { parseJsonCard } from '../packages/card-format'
import type { HostConfig } from '../runtime/host'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

test('real HDS forwards native image input, retains attachment history and holds restored stories', { timeout: 90000 }, async () => {
  const requests: any[] = []
  const model = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body)); response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾拿起手机查看小林发来的图片，随后放下手中的书给他回复。', interaction: { seen: true, reply: { mode: 'immediate', content: '图片收到啦。' } } }) } }] }))
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as { port: number }).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-image-chat-'))
  const config: HostConfig = { card: parseJsonCard(JSON.stringify({ name: '星禾', description: '与小林一起生活' })), endpoint: `http://127.0.0.1:${(model.address() as { port: number }).port}/chat/completions`, model: 'vision-fixture', userName: '小林', userProfile: '邻居', autoAdvance: false, token: 'image-fixture-token-longer-than-32-characters', port, dataDir, modelOptions: { visionEnabled: true } }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const dataUri = `data:image/jpeg;base64,${readFileSync('fixtures/images/vision-fixture.jpg').toString('base64')}`
    const upload = await host.dispatch('images.upload', { dataUri }) as { id: string }
    const payload = { requestId: 'image-chat-fixture-001', content: '', images: [upload.id] }
    await host.dispatch('messages.sendLocal', payload)
    await host.dispatch('messages.sendLocal', payload)
    const deadline = Date.now() + 25000
    while (!requests.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(requests.length)
    const images = requests[0].messages.flatMap((message: any) => Array.isArray(message.content) ? message.content.filter((part: any) => part.type === 'image_url') : [])
    assert.equal(images.length, 1); assert.equal(images[0].image_url.url, dataUri)
    const history = await host.dispatch('messages.history', {}) as { direction: string; images?: string[] }[]
    assert.equal(history.filter(row => row.direction === 'user').length, 1)
    assert.deepEqual(history.find(row => row.direction === 'user')?.images, [upload.id])
    await assert.rejects(host.dispatch('images.get', { id: '../settings' }))
    await host.stop(); host = undefined
    writeFileSync(join(dataDir, 'restore-held.json'), '{}')
    host = await startHost(config)
    assert.equal(((await host.dispatch('story.snapshot', {})) as any).story.status, 'paused')
    await assert.rejects(host.dispatch('messages.sendLocal', { requestId: 'paused-image-fixture-001', content: '测试暂停', images: [upload.id] }))
    assert.equal((await host.dispatch('images.get', { id: upload.id }) as { dataUri: string }).dataUri, dataUri)
    await host.stop(); host = undefined
    host = await startHost({ ...config, modelOptions: { visionEnabled: false } })
    await assert.rejects(host.dispatch('messages.sendLocal', { requestId: 'disabled-vision-fixture-001', content: '', images: [upload.id] }), /开启主模型识图/)
  } finally { if (host) await host.stop(); await new Promise<void>(resolve => model.close(() => resolve())) }
})
