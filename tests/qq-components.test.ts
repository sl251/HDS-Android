import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { displayAuthority, writeDisplayAuthority } from '../runtime/qq-display'
import { githubDownloadUrl, verifiedDownload } from '../runtime/qq-components'
import type { DownloadProgress } from '../packages/contracts'

test('Xauthority writes an authenticated wildcard record despite stale xauth locks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hds-xauth-'))
  try {
    const file = join(dir, 'display.auth')
    for (const suffix of ['-c', '-l']) await writeFile(file + suffix, 'stale lock')
    writeDisplayAuthority(file, 234)
    const record = await readFile(file)
    assert.equal(record.readUInt16BE(0), 65535)
    let offset = 2
    const field = () => { const size = record.readUInt16BE(offset); offset += 2; const value = record.subarray(offset, offset + size); offset += size; return value }
    assert.equal(field().length, 0)
    assert.equal(field().toString(), '234')
    assert.equal(field().toString(), 'MIT-MAGIC-COOKIE-1')
    assert.equal(field().length, 16)
    assert.equal(offset, record.length)
    writeDisplayAuthority(file, 234)
    assert.notDeepEqual(await readFile(file), record, 'Every start needs a fresh cookie')
    assert.throws(() => displayAuthority(-1, Buffer.alloc(16)))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('optional HTTPS accelerator only wraps GitHub artifact URLs', () => {
  const github = 'https://github.com/NapNeko/NapCatQQ/releases/download/v1/test.zip'
  assert.equal(githubDownloadUrl(github), github)
  assert.equal(githubDownloadUrl(github, ' https://mirror.example/proxy/ '), 'https://mirror.example/proxy/' + github)
  assert.equal(githubDownloadUrl('https://qqdl.gtimg.cn/qq.deb', 'https://mirror.example'), 'https://qqdl.gtimg.cn/qq.deb')
  for (const invalid of ['http://mirror.example', 'https://user:pass@mirror.example', 'https://mirror.example/?token=x', 'https://mirror.example/#x', 12]) assert.throws(() => githubDownloadUrl(github, invalid))
})

test('downloads report real bytes and enforce hashes, limits and cancellation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hds-download-'))
  const bytes = Buffer.from('verified component fixture')
  const spec = { url: 'https://download.example/file', sha256: createHash('sha256').update(bytes).digest('hex'), maxBytes: 100 }
  let withLength = true
  t.mock.method(globalThis, 'fetch', async (_: unknown, options: RequestInit) => {
    options.signal?.throwIfAborted()
    const response = new Response(bytes, { headers: withLength ? { 'content-length': String(bytes.length) } : {} })
    Object.defineProperty(response, 'url', { value: spec.url })
    return response
  })
  try {
    const updates: DownloadProgress[] = []
    const progress = (_: string, value?: DownloadProgress) => { if (value) updates.push(value) }
    const file = join(dir, 'file')
    await verifiedDownload(spec, file, new AbortController().signal, progress, 'QQ')
    assert.deepEqual(await readFile(file), bytes)
    assert.equal(updates[0].receivedBytes, 0)
    assert.equal(updates.at(-1)?.receivedBytes, bytes.length)
    assert.equal(updates.at(-1)?.totalBytes, bytes.length)
    withLength = false
    await verifiedDownload(spec, file, new AbortController().signal, progress)
    assert.equal(updates.at(-1)?.totalBytes, undefined)
    await assert.rejects(verifiedDownload({ ...spec, sha256: 'incorrect' }, file, new AbortController().signal, progress), /SHA-256/)
    await assert.rejects(verifiedDownload({ ...spec, maxBytes: 2 }, file, new AbortController().signal, progress), /大小/)
    await assert.rejects(verifiedDownload(spec, file, AbortSignal.abort(), progress), /abort/i)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
