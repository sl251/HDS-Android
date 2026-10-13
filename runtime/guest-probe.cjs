// Run the actual guest syscalls before passing model keys or opening the database.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function probe(expected = '/opt/hds', data = '/hds-data') {
  let stage = 'cwd', directory
  try {
    if (process.cwd() !== expected) throw new Error('unexpected working directory')
    stage = 'relative-read'
    if (fs.statSync('.').ino !== fs.statSync(expected).ino) throw new Error('relative path mismatch')
    stage = 'host-import'
    require(path.join(expected, 'host.cjs'))
    if (process.cwd() !== expected) throw new Error('working directory changed after imports')
    stage = 'data-write'
    directory = fs.mkdtempSync(path.join(data, '.hds-probe-'))
    await fs.promises.writeFile(path.join(directory, 'probe'), 'HDS syscall probe')
    if (await fs.promises.readFile(path.join(directory, 'probe'), 'utf8') !== 'HDS syscall probe') throw new Error('readback mismatch')
    stage = 'child-cwd'
    const child = spawnSync(process.execPath, ['-e', 'if(process.cwd()!==process.argv[1])process.exit(2)', directory], { cwd: directory, encoding: 'utf8', timeout: 8000, env: { ...process.env, HDS_MOBILE_MAIN: '0' }, shell: false, windowsHide: true })
    // The child must also cross the PRoot exec/chdir boundary successfully.
    if (child.error || child.status !== 0) throw child.error || new Error(`child exit ${child.status}: ${child.stderr.trim().slice(0, 300)}`)
    stage = 'cwd-after-io'
    process.chdir(expected) // Invalidate Node's cwd cache before rechecking the syscall.
    if (process.cwd() !== expected) throw new Error('working directory changed after I/O')
    stage = 'cleanup'
    await fs.promises.rm(directory, { recursive: true }); directory = undefined
    console.log('HDS_GUEST_PROBE_OK')
  } catch (error) {
    const code = typeof error.code === 'string' ? error.code : 'FAILED'
    console.error(`HDS_GUEST_PROBE_FAILED stage=${stage} code=${code} syscall=${error.syscall || 'unknown'}`)
    throw error
  } finally { if (directory) await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => {}) }
}
module.exports = { probe }
if (require.main === module) probe().then(() => process.exit(0), () => process.exit(1))
