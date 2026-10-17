import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Keep the complete mobile delta against pristine rc56 reviewable as a unified
// diff. Each hunk includes context and must match exactly once: upstream drift
// fails loudly instead of silently dropping a mobile integration.
function readPatches(file) {
  const patches = {}
  let name, hunk
  for (const line of readFileSync(new URL(file, import.meta.url), 'utf8').split('\n')) {
    if (line.startsWith('--- a/')) continue
    if (line.startsWith('+++ b/')) {
      name = line.slice(6)
      patches[name] = []
    } else if (line.startsWith('@@ ')) {
      hunk = { before: '', after: '' }
      patches[name].push(hunk)
    } else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '+') hunk.before += line.slice(1) + '\n'
      if (line[0] !== '-') hunk.after += line.slice(1) + '\n'
    }
  }
  return patches
}
export const mobilePatches = readPatches('./mobile-hds-rc56.patch')
export const mobileTestPatches = readPatches('./mobile-hds-rc56-tests.patch')

export function applyMobilePatches(source, name, patches = mobilePatches) {
  for (const [index, patch] of (patches[name] ?? []).entries()) {
    if (source.split(patch.after).length === 2) continue
    if (source.split(patch.before).length !== 2) throw new Error(`Mobile rc56 unknown/ambiguous anchor: ${name} #${index + 1}`)
    source = source.replace(patch.before, () => patch.after)
  }
  return source
}

export function patchMobile(directory = 'upstream/hds-interlude/src') {
  // Validate the entire replay before writing any file.
  const outputs = []
  for (const [base, patches] of [[directory, mobilePatches], [resolve(directory, '../test'), mobileTestPatches]]) {
    // Source-only fixtures need no vendored test clock correction.
    if (patches === mobileTestPatches && !existsSync(base)) continue
    for (const name of Object.keys(patches)) {
      const path = resolve(base, name)
      if (patches === mobileTestPatches && !existsSync(path)) continue
      outputs.push([path, applyMobilePatches(readFileSync(path, 'utf8'), name, patches)])
    }
  }
  for (const [path, source] of outputs) writeFileSync(path, source)
  console.log('Applied rc56 mobile patches: local channel, cards, management, drain, scheduled contact, budget, stickers and voice')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) patchMobile(process.argv[2] ?? 'upstream/hds-interlude/src')
