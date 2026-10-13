import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync, renameSync } from 'node:fs'

export function availableDisplayNumber() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const number = 100 + randomBytes(2).readUInt16LE() % 10000
    if (!existsSync(`/tmp/.X11-unix/X${number}`) && !existsSync(`/tmp/.X${number}-lock`)) return number
  }
  throw new Error('无法分配 QQ 虚拟显示编号，请停止 QQ 后重试')
}

export function xvfbArguments(display: number, authority: string) {
  // Android can deny link(2) even inside a writable private /tmp. PRoot -0
  // supplies the guest root UID required by Xserver's -nolock option.
  // This bypasses only its PID lock, NOT Xauthority authentication.
  return [`:${display}`, '-screen', '0', '640x480x24', '-nolock', '-nolisten', 'tcp', '-auth', authority]
}

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
