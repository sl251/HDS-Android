import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(readFileSync(join(root, 'HDS-Mobile-Plan/sources.lock.json'), 'utf8'))
const hds = lock.repositories.find(repo => repo.role === 'target')
const checkout = join(root, '.references/HDS-Interlude')
const destination = join(root, 'tools/hds-baseline/upstream')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

if (!existsSync(join(checkout, '.git'))) {
  mkdirSync(dirname(checkout), { recursive: true })
  git('clone', '--no-checkout', '--filter=blob:none', hds.url, checkout)
  git('-C', checkout, 'checkout', '--detach', hds.commit)
}
if (git('-C', checkout, 'rev-parse', 'HEAD') !== hds.commit) throw new Error('HDS checkout does not match sources.lock.json')
if (git('-C', checkout, 'status', '--porcelain', '--untracked-files=no')) throw new Error('HDS checkout has tracked changes; preserve them before preparing baseline')

// Only tracked upstream files; never copy .git, credentials, or runtime data.
const files = git('-C', checkout, 'ls-files', '-z').split('\0').filter(Boolean)
for (const file of files) {
  const target = join(destination, file)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(join(checkout, file), target)
}
console.log(`Prepared ${files.length} upstream files at ${hds.commit}`)
console.log('Install locked dependencies: npm ci --ignore-scripts --prefix tools/hds-baseline')
