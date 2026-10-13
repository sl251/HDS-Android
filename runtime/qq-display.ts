import { randomBytes } from 'node:crypto'
import { writeFileSync, renameSync } from 'node:fs'

/** Xauthority's binary wire format (CARD16 big-endian, length-prefixed fields).
 * FamilyWild matches the local Unix socket even when PRoot changes hostnames.
 * Writing directly avoids xauth's hard-link locking on Android bind mounts.
 */
export function displayAuthority(display: number, cookie: Buffer): Buffer {
  if (!Number.isInteger(display) || display < 0 || display > 65535 || cookie.length !== 16) throw new Error('Invalid Xauthority record')
  const field = (value: Buffer) => { const size = Buffer.alloc(2); size.writeUInt16BE(value.length); return Buffer.concat([size, value]) }
  return Buffer.concat([Buffer.from([0xff, 0xff]), field(Buffer.alloc(0)), field(Buffer.from(String(display))), field(Buffer.from('MIT-MAGIC-COOKIE-1')), field(cookie)])
}

export function writeDisplayAuthority(file: string, display: number) {
  writeFileSync(file + '.tmp', displayAuthority(display, randomBytes(16)), { mode: 0o600 })
  renameSync(file + '.tmp', file)
}
