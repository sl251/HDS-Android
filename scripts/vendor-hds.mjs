import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const upstreamCommit = 'ab512ec6b9dc00b9f738c062fe576e711a739151'
const checkout = resolve(process.argv[2] ?? '.references/HDS-Interlude')
const destination = resolve('upstream/hds-interlude')
if (!existsSync(checkout)) {
  mkdirSync(dirname(checkout), { recursive: true })
  execFileSync('git', ['clone', '--depth=1', '--branch', '1.0.1-rc57', '--no-checkout',
    'https://github.com/ISEKAI-MomoiCore/HDS-Interlude.git', checkout], { stdio: 'inherit' })
}
// Read the fixed Git object, never a potentially modified checkout. Fail before
// touching the vendor tree if this clone does not contain the expected commit.
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', '1.0.1-rc57^{commit}'], { encoding: 'utf8' }).trim()
if (commit !== upstreamCommit) throw new Error(`Unexpected rc56 commit: ${commit}`)
const archive = execFileSync('git', ['-C', checkout, 'archive', upstreamCommit], { maxBuffer: 64 * 1024 * 1024 })
// This intentionally replaces the tree; replay scripts/patch-mobile-hds.mjs next.
rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
execFileSync('tar', ['-x', '-C', destination], { input: archive })
console.log(`Vendored HDS 1.0.1-rc56 at ${upstreamCommit}; preserve LICENSE and original attribution`)
