import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('guest probe exercises host imports, real filesystem I/O and child cwd without a model', () => {
  const data = mkdtempSync(join(tmpdir(), 'hds-probe-test-'))
  const module = resolve('runtime/guest-probe.cjs'), host = resolve('runtime/generated')
  try {
    const result = spawnSync(process.execPath, ['-e', 'require(process.argv[1]).probe(process.argv[2],process.argv[3]).catch(()=>process.exit(1))', module, host, data], { cwd: host, encoding: 'utf8', env: { ...process.env, HDS_MOBILE_MAIN: '0' }, timeout: 15000 })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^HDS_GUEST_PROBE_OK\s*$/)
    assert.deepEqual(readdirSync(data), [])
  } finally { rmSync(data, { recursive: true, force: true }) }
})

test('guest probe surfaces ENOSYS at cwd and does not invent a working directory', () => {
  const result = spawnSync(process.execPath, ['-e', 'process.cwd=()=>{throw Object.assign(new Error("uv_cwd"),{code:"ENOSYS",syscall:"uv_cwd"})};require(process.argv[1]).probe().catch(()=>process.exit(1))', resolve('runtime/guest-probe.cjs')], { encoding: 'utf8', timeout: 15000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /stage=cwd code=ENOSYS syscall=uv_cwd/)
  assert.doesNotMatch(result.stdout, /HDS_GUEST_PROBE_OK/)
})
