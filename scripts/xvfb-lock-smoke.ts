// CI only: run the packaged ARM64 Xvfb with link/linkat forced to EACCES.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection } from 'node:net'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { availableDisplayNumber, displayAuthority, xvfbArguments } from '../runtime/qq-display'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    child.kill()
  })
}

async function authenticate(display: number, cookie: Buffer) {
  const name = Buffer.from('MIT-MAGIC-COOKIE-1')
  const header = Buffer.alloc(12)
  header[0] = 0x6c; header.writeUInt16LE(11, 2)
  header.writeUInt16LE(name.length, 6); header.writeUInt16LE(cookie.length, 8)
  const packet = Buffer.concat([header, name, Buffer.alloc((4 - name.length % 4) % 4), cookie])
  return new Promise<number>((resolve, reject) => {
    const socket = createConnection(`/tmp/.X11-unix/X${display}`)
    const timer = setTimeout(() => socket.destroy(new Error('X11 handshake timeout')), 2000)
    socket.once('connect', () => socket.write(packet))
    socket.once('error', reject)
    socket.once('data', data => { resolve(data[0]); socket.destroy() })
    socket.once('close', () => { clearTimeout(timer); reject(new Error('X11 closed before setup reply')) })
  })
}

async function main() {
  assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'arm64'); assert.equal(process.getuid?.(), 0)
  const directory = mkdtempSync('/tmp/hds-xvfb-check-')
  const authority = join(directory, 'auth'), display = availableDisplayNumber(), cookie = randomBytes(16)
  writeFileSync(authority, displayAuthority(display, cookie), { mode: 0o600 })
  const env = { ...process.env, LD_PRELOAD: '/opt/hds/deny-x11-hardlinks.so' }
  let child: ChildProcess | undefined
  try {
    let errors = ''
    child = spawn('/usr/bin/Xvfb', xvfbArguments(display, authority).filter(arg => arg !== '-nolock'), { env, stdio: ['ignore', 'ignore', 'pipe'] })
    child.stderr!.on('data', data => { errors += data })
    const deadline = Date.now() + 10000
    while (child.exitCode === null && Date.now() < deadline) await pause(50)
    assert.equal(child.exitCode, 1, 'Old arguments must reproduce the phone failure')
    assert.match(errors, /Linking lock file.*Permission denied/)
    console.log('PASS: packaged Xvfb reproduces the reported hard-link lock failure.')

    errors = ''
    child = spawn('/usr/bin/Xvfb', [...xvfbArguments(display, authority), '-noreset'], { env, stdio: ['ignore', 'ignore', 'pipe'] })
    child.stderr!.on('data', data => { errors += data })
    let ready = false
    const readyDeadline = Date.now() + 10000
    while (Date.now() < readyDeadline) {
      assert.equal(child.exitCode, null, errors)
      try { if (await authenticate(display, cookie) === 1) { ready = true; break } } catch {}
      await pause(100)
    }
    assert.ok(ready, 'Patched Xvfb must accept the correct cookie with hard links denied')
    assert.equal(await authenticate(display, randomBytes(16)), 0, 'An incorrect cookie must still be rejected')
    assert.equal(await authenticate(display, Buffer.alloc(0)), 0, 'A missing cookie must still be rejected')
    console.log('PASS: Xvfb starts with hard links denied; correct Xauthority accepted, wrong/missing cookies rejected.')
  } finally { if (child) await stop(child); rmSync(directory, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
