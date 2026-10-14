import test from 'node:test'
import assert from 'node:assert/strict'
import { messageImages } from '../packages/contracts'

test('attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists', () => {
  for (const value of [undefined, null, {}, { map: 'unexpected' }, '', 7]) assert.deepEqual(messageImages(value), [])
  const first = 'a'.repeat(64), second = 'b'.repeat(64)
  assert.deepEqual(messageImages([first, first, 1, null, {}, '../image', second]), [first, second])
})
