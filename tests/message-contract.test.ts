import test from 'node:test'
import assert from 'node:assert/strict'
import { messageImages } from '../packages/contracts'

test('attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists', () => {
  for (const value of [undefined, null, {}, { map: 'unexpected' }, '', 7]) assert.deepEqual(messageImages(value), [])
  const first = 'a'.repeat(64), second = 'b'.repeat(64)
  assert.deepEqual(messageImages([first, first, 1, null, {}, '../image', second]), [first, second])
})

test('message merge retains identity and detects a moving 200-row window', async () => {
  const { mergeMessages, messageStatusLabel } = await import('../packages/contracts')
  const rows = Array.from({ length: 200 }, (_, id) => ({ id: String(id), direction: 'user' as const, content: String(id), occurredAt: '2026-10-16T00:00:00Z', status: 'accepted', images: [] }))
  assert.equal(mergeMessages(rows, structuredClone(rows)), rows)
  const next = mergeMessages(rows, [...rows.slice(1), { ...rows[0], id: '200' }])
  assert.equal(next.length, 200); assert.equal(next[0], rows[1]); assert.equal(next.at(-1)?.id, '200')
  assert.match(messageStatusLabel(rows[0]), /核心已接收/)
  assert.equal(messageStatusLabel({ direction: 'character', status: 'delivered' }), '已显示')
})
test('refresh coordinator shares reads, follows dirty mutations and isolates revisions', async () => {
  const { refreshCoordinator } = await import('../packages/contracts')
  const pending: ((value: number) => void)[] = [], applied: number[][] = []
  const refresh = refreshCoordinator((revision: number) => new Promise<number>(resolve => pending.push(resolve)), (value, revision) => applied.push([value, revision]))
  const first = refresh(0)
  assert.equal(refresh(0), first)
  assert.equal(refresh(0, true), first)
  const other = refresh(1)
  assert.equal(pending.length, 2)
  pending[0](1); pending[1](3)
  await Promise.resolve(); await Promise.resolve()
  assert.equal(pending.length, 3)
  pending[2](2)
  await Promise.all([first, other])
  assert.deepEqual(applied, [[3, 1], [2, 0]])
  let fail = true
  const retry = refreshCoordinator(async () => { if (fail) throw new Error('read failed'); return 4 }, () => {})
  await assert.rejects(retry(0), /read failed/); fail = false; await retry(0)
})

test('explicit native rejection is failed; lost transport remains unknown', async () => {
  const { localRequestFailure } = await import('../packages/contracts')
  assert.equal(localRequestFailure({ code: 'IllegalArgumentException', message: 'Unauthorized' }), 'failed')
  assert.equal(localRequestFailure({ code: 'RPC_REJECTED', message: 'rejected' }), 'failed')
  assert.equal(localRequestFailure({ code: 'SocketTimeoutException', message: 'timeout' }), 'unknown')
  assert.equal(localRequestFailure(new Error('connection lost')), 'unknown')
})
