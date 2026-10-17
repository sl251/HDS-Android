// One-off: print exactly what hunk index.ts#1 expects vs what rc57 has.
import { readFileSync } from 'node:fs'

function readPatches(file) {
  const patches = {}
  let name, hunk
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('--- a/')) continue
    if (line.startsWith('+++ b/')) { name = line.slice(6); patches[name] = [] }
    else if (line.startsWith('@@ ')) { hunk = { before: '', after: '' }; patches[name].push(hunk) }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '+') hunk.before += line.slice(1) + '\n'
      if (line[0] !== '-') hunk.after += line.slice(1) + '\n'
    }
  }
  return patches
}

const patches = readPatches('scripts/mobile-hds-rc57.patch')
const src = readFileSync('upstream/hds-interlude/src/index.ts', 'utf8')
const hunk = patches['index.ts'][0]
console.log('=== HUNK BEFORE (JSON-escaped, first 400 chars) ===')
console.log(JSON.stringify(hunk.before.slice(0, 400)))
console.log('=== count in source:', src.split(hunk.before).length - 1)
// try to locate the retry line and show surroundings
const idx = src.indexOf('narrativeRetryDelaySeconds')
console.log('=== source around narrativeRetryDelaySeconds ===')
console.log(JSON.stringify(src.slice(idx - 200, idx + 500)))
