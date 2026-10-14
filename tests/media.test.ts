import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { imageStore } from '../runtime/media'

test('local image store bounds attachments, prevents path access and deduplicates content', () => {
  const root = mkdtempSync(join(tmpdir(), 'hds-media-'))
  try {
    const store = imageStore(root)
    const fixture = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 217]).toString('base64')}`
    const saved = store.save(fixture)
    assert.equal(store.save(fixture).id, saved.id)
    assert.equal(store.get(saved.id), fixture)
    assert.throws(() => store.get('../../settings'))
    assert.throws(() => store.save('data:image/png;base64,aGVsbG8='))
    assert.throws(() => store.save('data:image/jpeg;base64,aGVsbG8='))
    assert.throws(() => store.save(`data:image/jpeg;base64,${'A'.repeat(700000)}`))
  } finally { rmSync(root, { recursive: true, force: true }) }
})
