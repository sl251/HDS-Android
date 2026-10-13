import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'tools/hds-baseline/package.json'))
const cwd = join(root, 'tools/hds-baseline/upstream')
const evidence = join(root, 'docs/evidence/T01')
mkdirSync(evidence, { recursive: true })

const commands = [
  ['typecheck', [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', '--noEmit', '--incremental', 'false', '--composite', 'false', '--noUnusedLocals', '--noUnusedParameters']],
  ['test', ['--import', pathToFileURL(require.resolve('tsx')).href, '--test', 'test/*.test.ts']],
]
const results = []
for (const [name, args] of commands) {
  const started = new Date().toISOString()
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180_000 })
  writeFileSync(join(evidence, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? `\n${result.error}\n` : ''))
  results.push({ name, started, finished: new Date().toISOString(), status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, command: [process.execPath, ...args], cwd })
  console.log(`${name}: ${results.at(-1).status} (exit ${result.status})`)
}
writeFileSync(join(evidence, 'results.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, results }, null, 2) + '\n')
process.exitCode = results.every(result => result.status === 'PASS') ? 0 : 1
