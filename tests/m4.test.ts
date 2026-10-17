import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
const { h, Logger } = createRequire(import.meta.url)('koishi') as typeof import('koishi')
import { InterludeService, stickerDeliveryUrl, stableStickerAssetId } from '../upstream/hds-interlude/src/service'
import { stickerInstruction, systemPrompt } from '../upstream/hds-interlude/src/narrator'
import { localStickerConfig, stickerFileForSource, emptyStickerSystemPrompt } from '../runtime/stickers'
import { imageStore } from '../runtime/media'
import { mobileModelConfig } from '../runtime/model-config'
import { stripMediaMarkers, MessageContent } from '../apps/mobile-ui/MessageContent'
import { emptyLibrary, importIntoPack, stickerSyncPacks } from '../apps/mobile-ui/sticker-state'
import { parseJsonCard } from '../packages/card-format'
import type { HostConfig } from '../runtime/host'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const bytes = readFileSync('fixtures/images/sticker-fixture.gif')
const hash = createHash('sha256').update(bytes).digest('hex')
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(check: () => Promise<boolean>) { const end = Date.now() + 25000; while (Date.now() < end) { if (await check()) return; await sleep(100) }; assert.fail('M4 condition timed out') }

test('M4 catalog gate admits mobile-local and preserves OneBot/disabled/unsupported paths', async () => {
  const asset = { assetId: 'test', group: '开心包', description: '开心', aliases: [], animated: true }
  const service = { stickerConfig: { enabled: true }, rankStickerAssets: async () => [asset] }
  const catalog = (platform?: string) => (InterludeService.prototype as any).stickerCatalogForSession.call(service, platform ? { platform } : undefined)
  for (const platform of ['mobile-local', 'onebot', 'napcat']) assert.deepEqual(await catalog(platform), [asset])
  for (const platform of ['discord', 'telegram', undefined]) assert.deepEqual(await catalog(platform), [])
  service.stickerConfig.enabled = false
  assert.deepEqual(await catalog('mobile-local'), [])
  assert.deepEqual(await catalog('onebot'), [])
})

test('M4 empty instruction is exactly empty; populated instruction retains upstream threshold', () => {
  assert.equal(stickerInstruction(), ''); assert.equal(stickerInstruction([]), '')
  assert.doesNotMatch(emptyStickerSystemPrompt(systemPrompt('user-message', '', '', '', '', '')), /sticker|localMedia|贴纸|表情包/i)
  assert.match(stickerInstruction([{ assetId: 'x', group: 'g', description: '开心', aliases: [], animated: false }]), /willingness reaches 0.7/)
})

test('M4 pack sync excludes message-only assets and original media remains readable after export deletion', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hds-m4-files-'))
  try {
    assert.equal(localStickerConfig(dir).enabled, false)
    const asset = { id: hash, path: '/private/ignored.gif', mime: 'image/gif', size: bytes.length }
    const library = importIntoPack(emptyLibrary(), 'pack', '开心包', [asset, asset]).library
    library.messages['old:message'] = { ...asset, id: '0'.repeat(64) }
    assert.deepEqual(stickerSyncPacks(library), [{ id: 'pack', name: '开心包', ids: [hash] }])
    const group = join(dir, 'stickers', '开心包'); mkdirSync(group, { recursive: true })
    const file = join(group, `${hash}.gif`); writeFileSync(file, bytes)
    const config = localStickerConfig(dir); assert.equal(config.enabled, true)
    const assetId = stableStickerAssetId(`开心包/${hash}.gif`, hash)
    const lookup = async (id: string) => id === assetId ? { filePath: `开心包/${hash}.gif` } : undefined
    assert.equal(await stickerFileForSource(stickerDeliveryUrl('', assetId), config.directory, lookup), file)
    assert.equal(await stickerFileForSource(pathToFileURL(file).href, config.directory, lookup), file)
    assert.equal(await stickerFileForSource(file, config.directory, lookup), file)
    for (const src of ['https://bad/private.png', stickerDeliveryUrl('', 'unknown'), '../secret.png', 'file:///etc/passwd']) assert.equal(await stickerFileForSource(src, config.directory, lookup), undefined)
    writeFileSync(join(dir, 'outside.gif'), bytes); try { symlinkSync(join(dir, 'outside.gif'), join(group, 'link.gif')) } catch (e) { if (process.platform !== 'win32' || (e as NodeJS.ErrnoException).code !== 'EPERM') throw e }
    assert.equal(await stickerFileForSource(join(group, 'link.gif'), config.directory, lookup), undefined)
    const media = imageStore(dir), saved = media.registerSticker(bytes)
    assert.equal(media.get(saved.id), `data:image/gif;base64,${bytes.toString('base64')}`)
    assert.equal(media.registerSticker(bytes).id, saved.id)
    assert.throws(() => media.registerSticker(Buffer.from('bad')))
    assert.throws(() => media.registerSticker(Buffer.alloc(10 * 1024 * 1024 + 1)))
    rmSync(join(dir, 'stickers'), { recursive: true })
    assert.equal(localStickerConfig(dir).enabled, false)
    assert.equal(imageStore(dir).get(saved.id), media.get(saved.id))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('M4 visual route maps native/sidecar providers and leaves absent or text-only vision unassigned', () => {
  const providers = ['writer', 'vision'].map(id => ({ id, preset: 'custom', label: id, model: id, endpoint: 'https://example.com/v1', enabled: true, credentialPresent: false, useForMain: id === 'writer', useForCompaction: id === 'writer', useForAlter: id === 'writer', protocol: 'chat-completions' as const, imageInput: 'supported' as const }))
  const config = (modelOptions = {}) => mobileModelConfig({ endpoint: '', model: '', providers, modelOptions })
  assert.deepEqual(config().providers.map(p => p.useForStickers), [false, false])
  assert.deepEqual(config({ visionEnabled: true }).providers.map(p => p.useForStickers), [true, false])
  assert.deepEqual(config({ visionEnabled: true, visionProviderId: 'vision' }).providers.map(p => p.useForStickers), [false, true])
  assert.equal(mobileModelConfig({ endpoint: 'https://example.com/v1', model: 'legacy', modelOptions: { visionEnabled: true } }).providers[0].useForStickers, true)
  assert.equal(mobileModelConfig({ endpoint: '', model: '', providers: providers.map(p => ({ ...p, imageInput: 'unsupported' })), modelOptions: { visionEnabled: true } }).providers.some(p => p.useForStickers), false)
})

test('M4 character media marker stripping preserves prose, punctuation and ordinary bracket text', () => {
  const content = '你好[表情包]呀【贴纸】[图片: unknown][sticker foo]【图像】[image]【动图】[GIF] [普通文字]'
  assert.equal(stripMediaMarkers(content), '你好呀 [普通文字]')
  const markup = renderToStaticMarkup(React.createElement(MessageContent, { message: { content } }))
  assert.doesNotMatch(markup, /表情包|贴纸|图片|sticker|image|图像/)
  assert.match(markup, /普通文字/)
})

test('M4 actual host describes GIF, injects mobile catalog, delivers standalone/after-text and disables stale empty catalog', { timeout: 120000 }, async () => {
  const requests: any[] = [], logs: string[] = []
  let placement = 'after-text'
  const filePath = `开心包/${hash}.gif`, assetId = stableStickerAssetId(filePath, hash)
  const model = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    const parsed = JSON.parse(body); requests.push(parsed)
    const description = String(parsed.messages?.[0]?.content).startsWith('Describe this local chat sticker')
    const decision = description ? { description: '一只开心的小动物，表示高兴。', aliases: ['开心'] } : {
      script: placement === 'after-text' ? '星禾看了眼手机，微笑着给小林发消息：“今天很开心。”' : '星禾看了眼手机，微笑着发送了一张开心的小动物表情。',
      interaction: { seen: true, reply: placement === 'after-text' ? { mode: 'immediate', content: '今天很开心。' } : { mode: 'none' } },
      localMedia: { assetId, placement, willingness: .95 },
    }
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] }))
  })
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as any).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const dataDir = mkdtempSync(join(tmpdir(), 'hds-m4-host-'))
  mkdirSync(join(dataDir, 'stickers', '开心包'), { recursive: true }); writeFileSync(join(dataDir, 'stickers', filePath), bytes)
  const config: HostConfig = { card: parseJsonCard(JSON.stringify({ name: '星禾', description: '小林的邻居' })), endpoint: `http://127.0.0.1:${(model.address() as any).port}/v1/chat/completions`, model: 'm4-fixture', userName: '小林', userProfile: '邻居', autoAdvance: false, token: 'm4-test-token-longer-than-32-characters', port, dataDir, modelOptions: { visionEnabled: true } }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  const target = { record: (record: { content: string }) => logs.push(record.content) }; Logger.targets.push(target)
  const history = async () => await host!.dispatch('messages.history', {}) as any[]
  try {
    host = await startHost(config)
    assert.equal(host.app.interlude.config.stickers.enabled, true)
    await until(async () => (await host!.app.database.get('interlude_sticker', { status: 'active' })).length === 1)
    await host.dispatch('messages.sendLocal', { requestId: 'm4-after-text-request', content: '今天开心吗' })
    await until(async () => (await history()).some(row => row.direction === 'character' && row.images.length))
    const pair = (await history()).filter(row => row.direction === 'character')
    assert.deepEqual(pair.map(row => [row.content, row.images.length]), [['今天很开心。', 0], ['', 1]])
    assert.ok(Date.parse(pair[0].occurredAt) < Date.parse(pair[1].occurredAt))
    const uri = (await host.dispatch('images.get', { id: pair[1].images[0] }) as any).dataUri
    assert.equal(uri, `data:image/gif;base64,${bytes.toString('base64')}`)
    const narrative = requests.find(row => !String(row.messages[0].content).startsWith('Describe this local chat sticker'))
    assert.match(narrative.messages[0].content, /CURRENT LOCAL STICKER LIBRARY/)
    assert.ok(JSON.stringify(narrative).includes(assetId))
    const since = await host.dispatch('messages.since', { since: '2000-01-01T00:00:00Z' }) as any[]
    assert.equal(since.at(-1).fullContent, '[表情包]')
    placement = 'standalone'
    await host.dispatch('messages.sendLocal', { requestId: 'm4-standalone-request', content: '那发个表情吧' })
    await until(async () => (await history()).filter(row => row.direction === 'character').length >= 3)
    assert.deepEqual((await history()).filter(row => row.direction === 'character').slice(2).map(row => [row.content, row.images.length]), [['', 1]])
    const [id1, id2] = await host.bot.sendMessage('private:local-user', `直接文本${h('img', { src: stickerDeliveryUrl('', assetId) })}`)
    assert.ok(id1 && id2)
    assert.deepEqual((await history()).filter(row => [id1, id2].includes(row.id)).map(row => [row.content, row.images.length]), [['直接文本', 0], ['', 1]])
    const [plain] = await host.bot.sendMessage('local-user', '纯文本不回归')
    assert.equal((await history()).find(row => row.id === plain).content, '纯文本不回归')
    await host.stop(); host = undefined
    rmSync(join(dataDir, 'stickers'), { recursive: true })
    // Existing active rows deliberately remain: filesystem emptiness is authoritative.
    requests.length = 0
    host = await startHost({ ...config, card: parseJsonCard(JSON.stringify({ name: '新角色', description: '空库测试' })) })
    assert.equal(host.app.interlude.config.stickers.enabled, false)
    assert.equal((await host.dispatch('images.get', { id: pair[1].images[0] }) as any).dataUri, uri)
    await host.dispatch('messages.sendLocal', { requestId: 'm4-empty-library-request', content: '你好' })
    await until(async () => requests.length > 0)
    const emptyPrompt = requests[0].messages[0].content
    assert.doesNotMatch(emptyPrompt, /sticker|localMedia|贴纸|表情包/i)
    assert.doesNotMatch(JSON.stringify(requests[0]), /stickerCatalog/)
    await host.stop(); host = undefined
    mkdirSync(join(dataDir, 'stickers', '开心包'), { recursive: true }); writeFileSync(join(dataDir, 'stickers', '开心包', `${'a'.repeat(64)}.gif`), bytes)
    // Different path is pending, with no visual route: upstream must warn rather than hide it.
    host = await startHost({ ...config, modelOptions: { visionEnabled: false } })
    await until(async () => logs.some(line => line.includes('没有配置 useForStickers')))
  } finally { if (host) await host.stop(); Logger.targets.splice(Logger.targets.indexOf(target), 1); await new Promise<void>(resolve => model.close(() => resolve())); rmSync(dataDir, { recursive: true, force: true }) }
})
