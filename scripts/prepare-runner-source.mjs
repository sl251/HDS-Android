import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const commit = 'dc4c3a9405dc7ed3ef69b2ac9a6ace65374d77cf'
const folder = resolve('artifacts/native-source')
mkdirSync(folder, { recursive: true })
function api(path) {
  const result = spawnSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.status !== 0) throw new Error('Source API fetch failed')
  return JSON.parse(result.stdout)
}
const tree = api(`repos/AAswordman/Operit2/git/trees/${commit}?recursive=1`)
if (tree.truncated) throw new Error('Source tree was truncated')
for (const entry of tree.tree.filter(entry => entry.type === 'blob' && (entry.path.startsWith('tools/android-runtime/') || entry.path === 'LICENSE'))) {
  if (entry.path.split('/').includes('..')) throw new Error('Invalid source path')
  const blob = api(`repos/AAswordman/Operit2/git/blobs/${entry.sha}`)
  const content = Buffer.from(blob.content, 'base64')
  if (createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex') !== entry.sha) throw new Error('Git blob integrity failed')
  const target = resolve(folder, 'Operit2', entry.path)
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content)
}
const sources = [
  ['termux-proot-v5.1.107.78.tar.gz', 'https://codeload.github.com/termux/proot/tar.gz/refs/tags/v5.1.107.78', 'f3377ba49dcd833370420c34c5081b4c243ecbb85b2a9881a4f4586012599afa'],
  ['talloc-2.4.3.tar.gz', 'https://www.samba.org/ftp/talloc/talloc-2.4.3.tar.gz', 'dc46c40b9f46bb34dd97fe41f548b0e8b247b77a918576733c528e83abd854dd'],
]
for (const [filename, url, expected] of sources) {
  const response = await fetch(url); if (!response.ok) throw new Error(`Source download failed: ${filename}`)
  const chunks = []; let length = 0
  for await (const chunk of response.body) { length += chunk.length; if (length > 32 * 1024 * 1024) throw new Error('Source archive exceeds cap'); chunks.push(chunk) }
  const bytes = Buffer.concat(chunks)
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Source checksum failed: ${filename}`)
  writeFileSync(resolve(folder, filename), bytes)
}
writeFileSync(resolve(folder, 'PROVENANCE.json'), JSON.stringify({ repository: 'AAswordman/Operit2', commit, sources, note: 'Pinned PRoot/talloc sources plus Android patch and build scripts. Imported runner hashes are in runtime/sources.lock.json; no bit-for-bit rebuild is claimed.' }, null, 2))
const archive = resolve('artifacts/HDS-Android-native-sources.tar.gz')
const packed = spawnSync('tar', ['-czf', archive, '-C', folder, '.'], { encoding: 'utf8' })
if (packed.status !== 0) throw new Error('Source archive packaging failed')
console.log('Prepared pinned PRoot/talloc sources, Operit Android patch and build instructions')
