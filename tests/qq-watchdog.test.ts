import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { EventEmitter, once } from 'node:events'
import { PassThrough } from 'node:stream'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { QQRuntime, terminateQQProcesses } = createRequire(import.meta.url)('../runtime/generated/qq.cjs') as typeof import('../runtime/qq')
const fakeChild = () => Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null })

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'hds-qq-watchdog-'))
  const app = { on() {}, middleware() {}, before() {}, bots: [{ platform: 'onebot', selfId: '55555', status: 1 }], plugin: () => ({ dispose: async () => {} }) }
  const qq = new QQRuntime(app as any, directory, directory, { onebot: {} }) as any
  clearInterval(qq.timer)
  Object.assign(qq, { child: fakeChild(), phase: 'online', account: '55555', loginOnline: true, hadLogin: true, watchdogEnabled: true, startedAt: Date.now() - 5000 })
  const events: string[] = [], calls: { method: string; data: any }[] = []
  const state = { status: { isLogin: false, coreReady: false, isOffline: true } as any, accounts: [{ uin: '99999', isQuickLogin: true }, { uin: '55555', isQuickLogin: true }], quickError: '', launches: 0 }
  qq.api = async (method: string, data: any) => {
    calls.push({ method, data })
    if (method === 'QQLogin/CheckLoginStatus') return state.status
    if (method === 'QQLogin/GetQQLoginInfo') return { uin: '55555', nick: 'fixture' }
    if (method === 'QQLogin/GetQuickLoginListNew') { events.push('cache'); return state.accounts }
    if (method === 'QQLogin/SetQuickLogin') { events.push('quick-login'); if (state.quickError) throw new Error(state.quickError) }
    if (method === 'QQLogin/RefreshQRcode') events.push('qr')
    return {}
  }
  const cleanup = qq.cleanupProcesses.bind(qq)
  qq.cleanupProcesses = async () => { events.push('cleanup'); await cleanup(); events.push('cleaned') }
  // Replace only OS startup: production polling, recovery, timers, cached-login
  // selection, generation checks and control queue run unchanged.
  qq.launch = async () => {
    events.push('restart'); state.launches++
    Object.assign(qq, { child: fakeChild(), phase: 'starting', closing: false, hadLogin: false, loginOnline: false, onlineSince: 0, loginFailures: 0, startedAt: Date.now(), generation: qq.generation + 1 })
    qq.watchChild(qq.child, qq.generation)
    state.status = { isLogin: false, coreReady: false, isOffline: false }
    await qq.poll()
  }
  t.after(async () => { await qq.close(); rmSync(directory, { recursive: true, force: true }) })
  return { qq, state, events, calls }
}

// Recovery can enqueue another operation while its current control task runs.
const drain = async (qq: any) => { for (let i = 0; i < 5; i++) await qq.control }

test('watchdog: offline → cleanup → 30s backoff → restart → cached login → stable online', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const { qq, state, events, calls } = fixture(t)
  qq.fork = { dispose: async () => events.push('dispose') }
  await qq.poll()
  assert.equal(qq.status().recovery.state, 'cleaning')
  assert.equal(qq.status().loggedIn, false)
  assert.equal(qq.status().online, false)
  assert.equal(qq.status().qr, '')
  assert.match((await qq.dispatch('qq.status', {})).progress, /自动恢复中.*清理/)
  qq.handleOffline('duplicate SelfOffline', 'log')
  await drain(qq)
  assert.deepEqual(events, ['cleanup', 'dispose', 'cleaned'])
  assert.equal(qq.status().recovery.state, 'backoff')
  assert.equal(qq.status().running, false)
  assert.equal(qq.status().recovery.nextRetryAt, 1025000)
  assert.match(qq.status().progress, /自动恢复中.*25 秒/)
  await assert.rejects(qq.dispatch('qq.quickLogin', { uin: '55555' }), /自动恢复中/)
  t.mock.timers.tick(24999); await drain(qq)
  assert.equal(state.launches, 0)
  t.mock.timers.tick(1); await drain(qq)
  assert.equal(state.launches, 1)
  assert.equal(qq.status().recovery.state, 'quick-login')
  assert.match(qq.status().progress, /自动恢复中.*快速登录/)
  assert.deepEqual(events, ['cleanup', 'dispose', 'cleaned', 'restart', 'cache', 'quick-login'])
  assert.deepEqual(calls.find(row => row.method.endsWith('/SetQuickLogin'))?.data, { uin: '55555' }, 'Prefer the account that went offline, even if another account is first')
  state.status = { isLogin: true, coreReady: true }
  await qq.poll()
  assert.equal(qq.status().phase, 'online')
  assert.equal(qq.status().recovery.state, 'idle')
  assert.equal(qq.status().recovery.attempts, 1, 'A brief login cannot reset the failure budget')
  t.mock.timers.tick(60000); await qq.poll()
  assert.equal(qq.status().recovery.attempts, 0)
})

test('watchdog: repeated crashes retain backoff and give up after five launches, cleaning the last process', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 2000000 })
  const { qq, state, events } = fixture(t)
  qq.launch = async () => {
    state.launches++; events.push('restart')
    assert.equal(qq.status().recovery.state, 'restarting')
    qq.child = fakeChild()
    throw new Error('fixture startup failure')
  }
  qq.handleOffline('SelfOffline', 'log'); await drain(qq)
  for (let attempt = 1; attempt <= 5; attempt++) {
    t.mock.timers.tick(attempt === 1 ? 24999 : 29999); await drain(qq)
    assert.equal(state.launches, attempt - 1)
    t.mock.timers.tick(1); await drain(qq)
    assert.equal(state.launches, attempt)
    assert.equal(qq.status().recovery.attempts, attempt)
    assert.equal(qq.status().recovery.state, attempt === 5 ? 'gave-up' : 'backoff')
  }
  assert.equal(events.filter(event => event === 'cleaned').length, 6)
  assert.equal(qq.status().running, false)
  assert.match(qq.status().progress, /人工介入/)
  assert.match(qq.status().error, /连续 5 次/)
  qq.handleOffline('another exit', 'process')
  t.mock.timers.tick(300000); await drain(qq)
  assert.equal(state.launches, 5)
})

test('watchdog: quick-login rejection, error status, timeout and absent same-account cache return to a real QR', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 3000000 })
  const { qq, state, calls } = fixture(t)
  for (const mode of ['rejected', 'error-status', 'offline-status', 'timeout', 'missing-cache']) {
    qq.cancelRecovery(); qq.watchdogEnabled = true
    qq.recovery = { state: 'restarting', attempts: 1, nextRetryAt: 0, reason: '' }
    qq.hadLogin = false; qq.loginOnline = false; qq.child = fakeChild()
    state.quickError = mode === 'rejected' ? '当前账号已登录,无法重复登录' : ''
    state.accounts = mode === 'missing-cache' ? [{ uin: '99999', isQuickLogin: true }] : [{ uin: '55555', isQuickLogin: true }]
    state.status = { isLogin: false, coreReady: false }
    const before = calls.filter(row => row.method.endsWith('/RefreshQRcode')).length
    await qq.poll()
    if (['error-status', 'offline-status', 'timeout'].includes(mode)) {
      assert.equal(qq.status().recovery.state, 'quick-login')
      if (mode === 'timeout') t.mock.timers.tick(30000)
      else state.status = { isLogin: false, coreReady: false, loginError: mode === 'error-status' ? '登录凭据失效' : '', isOffline: mode === 'offline-status' }
      await qq.poll(); await drain(qq)
    }
    assert.equal(qq.status().recovery.state, 'waiting-qr', mode)
    assert.equal(qq.status().phase, 'qr', mode)
    assert.equal(calls.filter(row => row.method.endsWith('/RefreshQRcode')).length, before + 1, mode)
    state.status = { isLogin: false, isOffline: true, qrcodeurl: 'https://example.invalid/qr-fixture' }
    await qq.poll()
    assert.match(qq.status().qr, /^data:image\/png;base64,/, mode)
    assert.match(qq.status().progress, /请用官方 QQ 扫码/)
  }
  assert.equal(state.launches, 0)
})

test('watchdog: split SelfOffline logs, status login loss, process error and exit share one cleanup entry', async t => {
  const { qq, state, events } = fixture(t)
  for (const source of ['log', 'status', 'error', 'exit']) {
    qq.cancelRecovery(); qq.watchdogEnabled = true
    qq.recovery = { state: 'idle', attempts: 0, nextRetryAt: 0, reason: '' }
    qq.closing = false; qq.hadLogin = true; qq.loginOnline = true
    const child = fakeChild(); qq.child = child
    qq.watchChild(child, qq.generation)
    const before = events.filter(event => event === 'cleanup').length
    if (source === 'log') {
      child.stdout.write('[SelfOff')
      assert.equal(qq.status().recovery.state, 'idle')
      child.stdout.write('line] 账号状态变更为离线（未收到 KickedOffLine 通知）')
      child.stderr.write('[SelfOffline] duplicate\n')
    } else if (source === 'status') { state.status = { isLogin: false, coreReady: false }; await qq.poll() }
    else if (source === 'error') child.emit('error', new Error('fixture spawn error'))
    else child.emit('exit', 1, null)
    assert.equal(qq.status().recovery.state, 'cleaning', source)
    await drain(qq)
    assert.equal(events.filter(event => event === 'cleanup').length, before + 1, source)
  }
})

test('watchdog: stop cancels backoff and close invalidates an in-flight status response', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 4000000 })
  const { qq, state } = fixture(t)
  qq.handleOffline('SelfOffline', 'log'); await drain(qq)
  assert.equal(qq.status().recovery.state, 'backoff')
  await qq.dispatch('qq.stop', {})
  t.mock.timers.tick(300000); await drain(qq)
  assert.equal(state.launches, 0)
  assert.equal(qq.status().phase, 'stopped')
  qq.watchdogEnabled = true; qq.closing = false; qq.child = fakeChild(); qq.hadLogin = true
  let reply!: (value: any) => void
  qq.api = () => new Promise(resolve => { reply = resolve })
  const polling = qq.poll()
  await qq.close()
  reply({ isLogin: true, coreReady: true })
  await polling
  assert.equal(qq.status().phase, 'stopped')
  assert.equal(qq.status().loggedIn, false)
  t.mock.timers.tick(300000); await drain(qq)
  assert.equal(state.launches, 0)
})

test('watchdog: startup grace, repeated status timeouts and cleanup failures cannot create a crash loop', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 5000000 })
  const { qq, state } = fixture(t)
  qq.hadLogin = false; qq.phase = 'starting'; qq.startedAt = Date.now()
  qq.api = async () => { throw new Error('The operation was aborted due to timeout.') }
  await qq.poll()
  assert.equal(qq.status().recovery.state, 'idle')
  t.mock.timers.tick(120000); await qq.poll(); await drain(qq)
  assert.equal(qq.status().recovery.state, 'backoff')
  qq.cancelRecovery(); qq.watchdogEnabled = true; qq.recovery.state = 'idle'
  qq.child = fakeChild(); qq.phase = 'online'; qq.hadLogin = true; qq.loginFailures = 0
  await qq.poll(); await qq.poll()
  assert.equal(qq.status().recovery.state, 'idle', 'Two transient timeouts should be retried')
  qq.cleanupProcesses = async () => { throw new Error('fixture EPERM') }
  await qq.poll(); await drain(qq)
  assert.equal(qq.status().recovery.state, 'gave-up')
  assert.match(qq.status().error, /EPERM/)
  t.mock.timers.tick(300000); await drain(qq)
  assert.equal(state.launches, 0, 'Never launch a second QQ if old processes could not be killed')
  qq.cleanupProcesses = async () => { qq.child = undefined }
})

const alive = (pid: number) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    return !['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0])
  } catch { return false }
}

test('watchdog: late HTTP responses cannot overwrite a restarted process credential', { timeout: 3000 }, async t => {
  const { qq } = fixture(t)
  qq.api = QQRuntime.prototype.api
  qq.webToken = 'fixture-secret'; qq.webPort = 12345
  let reply!: (value: Response) => void
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { reply = resolve }))
  const request = qq.api('QQLogin/CheckLoginStatus')
  qq.generation++; qq.credential = 'new-process-credential'; qq.credentialAt = Date.now()
  reply(new Response(JSON.stringify({ code: 0, data: { Credential: 'stale-process-credential' } })))
  await assert.rejects(request, /所属进程已失效/)
  assert.equal(qq.credential, 'new-process-credential')
  const authenticated = qq.api('QQLogin/CheckLoginStatus')
  qq.generation++
  reply(new Response(JSON.stringify({ code: -1, message: 'stale auth error' })))
  await assert.rejects(authenticated, /所属进程已失效/)
  assert.equal(qq.credential, 'new-process-credential')
})

test('watchdog: a stuck adapter still cleans processes and stops recovery within a bound', { timeout: 3000 }, async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 6000000 })
  const { qq, state } = fixture(t)
  qq.fork = { dispose: () => new Promise(() => {}) }
  qq.handleOffline('SelfOffline', 'log')
  // Let cleanup arm its disposal timeout without awaiting the pending control.
  await Promise.resolve(); await Promise.resolve()
  t.mock.timers.tick(2000); await drain(qq)
  assert.equal(qq.status().running, false)
  assert.equal(qq.status().recovery.state, 'gave-up')
  assert.match(qq.status().error, /消息通道关闭超时/)
  t.mock.timers.tick(300000); await drain(qq)
  assert.equal(state.launches, 0)
})

test('process cleanup kills a TERM-resistant descendant after its launcher exits, preserving unrelated processes', { timeout: 10000 }, async () => {
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })
  const descendantScript = "process.on('SIGTERM', () => {}); console.log(process.pid); setInterval(() => {}, 1000)"
  const launcherScript = `const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: ['ignore', 'inherit', 'inherit'] }); setInterval(() => {}, 1000)`
  const launcher = spawn(process.execPath, ['-e', launcherScript], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let descendant = 0
  try {
    descendant = Number(String((await once(launcher.stdout!, 'data'))[0]).trim())
    assert.ok(descendant > 0)
    const exit = once(launcher, 'exit')
    launcher.kill('SIGTERM'); await exit
    assert.equal(alive(descendant), true, 'The descendant survives its launcher and still owns the login cache')
    await terminateQQProcesses([launcher], 50)
    assert.equal(alive(descendant), false)
    assert.equal(alive(unrelated.pid!), true)
  } finally {
    try { process.kill(-launcher.pid!, 'SIGKILL') } catch {}
    const exited = once(unrelated, 'exit'); unrelated.kill('SIGKILL'); await exited
  }
})

test('process cleanup is bounded for failed spawns and escalates an uncooperative live launcher', { timeout: 10000 }, async () => {
  const failed = spawn('/no-such-qq-watchdog-executable', [], { detached: true, stdio: 'ignore' })
  await once(failed, 'error')
  await terminateQQProcesses([failed], 50)
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)"], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    await once(child.stdout!, 'data')
    await terminateQQProcesses([child], 50)
    assert.equal(child.signalCode, 'SIGKILL')
    assert.equal(alive(child.pid!), false)
  } finally { try { process.kill(-child.pid!, 'SIGKILL') } catch {} }
})
