import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { composerEnter, createDraftStore, splitThinking } from '../apps/mobile-ui/composer-state'
import { importIntoPack, recentStickers, sortedPacks, stickerEntryVisible, useSticker, emptyLibrary, libraryBytes, stickerMessageKey, type StickerAsset } from '../apps/mobile-ui/sticker-state'
import { canDismissImage, clampZoom } from '../apps/mobile-ui/ImageLightbox'
import { MessageContent } from '../apps/mobile-ui/MessageContent'
import { StoredImage } from '../apps/mobile-ui/StoredImage'
import type { NativeBridge } from '../packages/contracts'

const asset = (id: string): StickerAsset => ({ id: id.padStart(64, '0'), path: `/private/${id}.gif`, mime: 'image/gif', size: 120 })
test('M3 CJK composition gates Enter, Android 229 and the composition interval; Shift+Enter stays multiline', () => {
  assert.equal(composerEnter({ key: 'Enter', isComposing: true }), 'composition')
  assert.equal(composerEnter({ key: 'Enter', keyCode: 229 }), 'composition')
  assert.equal(composerEnter({ key: 'Enter' }, true), 'composition')
  assert.equal(composerEnter({ key: 'Enter' }), 'send')
  assert.equal(composerEnter({ key: 'Enter', shiftKey: true }), 'newline')
  assert.equal(composerEnter({ key: 'a' }), 'newline')
})

test('M3 drafts isolate card IDs, persist attachments across reload and clear only the sent card', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  const store = createDraftStore(storage), first = { content: '第一位', attachments: [{ id: 'a'.repeat(64), dataUri: 'data:image/jpeg;base64,/9j/2Q==' }] }
  store.write('first', first); store.write('second', { content: '第二位', attachments: [] })
  const restarted = createDraftStore(storage)
  assert.deepEqual(restarted.read('first'), first)
  assert.equal(restarted.read('second').content, '第二位')
  restarted.write('first', { content: '', attachments: [] })
  assert.equal(storage.getItem('hds-draft-first'), null)
  assert.equal(restarted.read('second').content, '第二位')
  storage.setItem('hds-draft-broken', '{')
  assert.deepEqual(restarted.read('broken'), { content: '', attachments: [] })
})

test('M3 sticker import deduplicates content hashes within a pack; recents deduplicate across packs and cap at 16', () => {
  const imported = importIntoPack(emptyLibrary(), 'one', '一', [asset('a'), asset('a'), asset('b')], 1)
  assert.deepEqual([imported.imported, imported.skipped], [2, 1])
  const again = importIntoPack(imported.library, 'one', 'ignored', [asset('a'), asset('c')], 2)
  assert.deepEqual([again.imported, again.skipped], [1, 1])
  assert.equal(again.library.packs[0].name, '一')
  let library = importIntoPack(again.library, 'two', '二', Array.from({ length: 20 }, (_, i) => asset(i.toString(16))), 2).library
  assert.equal(sortedPacks(library)[0].id, 'two')
  library = useSticker(library, 'one', asset('a').id, 100)
  assert.equal(sortedPacks(library)[0].id, 'one')
  for (let i = 0; i < 20; i++) library = useSticker(library, 'two', asset(i.toString(16)).id, 110 + i)
  const recent = recentStickers(library)
  assert.equal(recent.length, 16)
  assert.equal(new Set(recent.map(item => item.sticker.id)).size, 16)
  assert.equal(recent[0].sticker.id, asset('13').id)
  assert.equal(sortedPacks(library)[0].id, 'two')
  assert.equal(libraryBytes(importIntoPack(emptyLibrary(), 'p', 'p', [asset('a'), asset('a')]).library), 120)
})

test('M3 empty sticker libraries hide chat entry; local message mapping survives pack deletion', () => {
  const empty = emptyLibrary()
  assert.equal(stickerEntryVisible(empty), false)
  const { library } = importIntoPack(empty, 'one', '一', [asset('a')])
  assert.equal(stickerEntryVisible(library), true)
  library.messages[stickerMessageKey('first', 'message')] = asset('a')
  library.packs = []
  assert.equal(stickerEntryVisible(library), false)
  assert.equal(libraryBytes(library), 120)
  assert.equal(library.messages[stickerMessageKey('second', 'message')], undefined)
  const markup = renderToStaticMarkup(React.createElement(StoredImage, { id: 'a'.repeat(64), source: '/private/a.gif', bridge: {} as NativeBridge }))
  assert.match(markup, /src="\/private\/a.gif"/)
})

test('M3 lightbox zoom clamps and downward dismissal respects zoom, direction and native long-image scroll', () => {
  assert.equal(clampZoom(.3), 1); assert.equal(clampZoom(9), 4)
  assert.equal(canDismissImage(1, 0, 5, 120), true)
  assert.equal(canDismissImage(2, 0, 5, 120), false)
  assert.equal(canDismissImage(1, 20, 5, 120), false)
  assert.equal(canDismissImage(1, 0, 120, 110), false)
  assert.equal(canDismissImage(1, 0, 0, -120), false)
})

test('M3 thinking is folded by default for current and historical content, with honest absent timing', () => {
  assert.deepEqual(splitThinking({ content: '<think>私密思考</think>可见回复' }), { content: '可见回复', thought: '私密思考' })
  assert.deepEqual(splitThinking({ content: '回复', reasoning_content: '上游推理' }), { content: '回复', thought: '上游推理' })
  const markup = renderToStaticMarkup(React.createElement(MessageContent, { message: { content: '<think>私密思考</think>可见回复' } }))
  assert.match(markup, /aria-expanded="false"/); assert.match(markup, /耗时未提供/)
  assert.ok(!markup.includes('私密思考')); assert.ok(markup.includes('可见回复'))
})
