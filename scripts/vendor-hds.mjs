import { execFileSync } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
const files = execFileSync('git', ['-C', '.references/HDS-Interlude', 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
for (const file of files) {
  const target = resolve('upstream/hds-interlude', file)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(resolve('.references/HDS-Interlude', file), target)
}
console.log(`Vendored ${files.length} fixed upstream files; preserve LICENSE and original attribution`)
