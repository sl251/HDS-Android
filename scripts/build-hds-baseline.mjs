import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'tools/hds-baseline/package.json'))
const { build } = require('esbuild')
const upstream = join(root, 'tools/hds-baseline/upstream')
const output = join(upstream, 'lib/index.js')
await build({
  absWorkingDir: upstream,
  entryPoints: ['src/index.ts'],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  packages: 'external',
  tsconfig: 'tsconfig.json',
})

const bundle = require(output)
const manifest = JSON.parse(readFileSync(join(upstream, 'package.json'), 'utf8'))
if (bundle.version !== manifest.version || bundle.name !== 'hds-interlude' || typeof bundle.apply !== 'function' || !bundle.Config) throw new Error('Fresh bundle exports do not match the HDS plugin contract')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const sources = []
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.ts')) sources.push({ path: relative(upstream, file).replaceAll('\\', '/'), sha256: hash(file) })
  }
}
walk(join(upstream, 'src'))
const evidence = join(root, 'docs/evidence/T01')
mkdirSync(evidence, { recursive: true })
writeFileSync(join(evidence, 'bundle.json'), JSON.stringify({ status: 'PASS', validation: 'Fresh source bundle and plugin export smoke check; no Android or live model validation', version: bundle.version, node: process.version, esbuild: require('esbuild').version, sha256: hash(output), sources }, null, 2) + '\n')
console.log(`Fresh HDS ${bundle.version} bundle: PASS (${sources.length} source files)`)
