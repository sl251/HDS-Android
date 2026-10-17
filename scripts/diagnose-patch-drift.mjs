// Diagnose which rc56 patch hunks still apply cleanly to the rc57 vendor tree.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readPatches(file) {
  const patches = {}
  let name, hunk
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('--- a/')) continue
    if (line.startsWith('+++ b/')) { name = line.slice(6); patches[name] = [] }
    else if (line.startsWith('@@ ')) { hunk = { before: '', after: '' }; patches[name].push(hunk) }
    else if (hunk && /^[ +-]/.test(line)) {
      if (line[0] !== '+') hunk.before += line.slice(1) + '\n'
      if (line[0] !== '-') hunk.after += line.slice(1) + '\n'
    }
  }
  return patches
}

const patches = readPatches('scripts/mobile-hds-rc56.patch')
const base = 'upstream/hds-interlude/src'
for (const [name, hunks] of Object.entries(patches)) {
  const source = readFileSync(resolve(base, name), 'utf8')
  let ok = 0, alreadyApplied = 0, failed = []
  // Simulate sequential application like applyMobilePatches
  let current = source
  for (const [i, hunk] of hunks.entries()) {
    if (current.split(hunk.after).length === 2) { alreadyApplied++; continue }
    if (current.split(hunk.before).length !== 2) { failed.push(i + 1); continue }
    current = current.replace(hunk.before, () => hunk.after)
    ok++
  }
  console.log(`${name}: total=${hunks.length} apply=${ok} already=${alreadyApplied} FAILED=[${failed.join(',')}]`)
}
