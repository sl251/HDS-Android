import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackgroundBudget } from '../runtime/background-budget'
import { parseJsonCard } from '../packages/card-format'
const { startHost, mobileSchema, normalizeMobileConfig, mapMobileConfig, mobilePreset, inspectPreset } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')

test('supported schema derives upstream defaults; master switch gates independent scheduling', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(mobileSchema())), JSON.parse(readFileSync('packages/contracts/mobile-config.schema.json', 'utf8')))
  assert.deepEqual(JSON.parse(JSON.stringify(mobileSchema())), JSON.parse(readFileSync('android/app/src/main/assets/mobile-config.schema.json', 'utf8')))
  const settings = { sections: { urge: { enabled: true }, agency: { enabled: true }, runtime: { conversationFollowUpMinutes: [7, 31] } } }
  assert.deepEqual(mapMobileConfig(settings, true).runtime.conversationFollowUpMinutes, [])
  assert.equal(mapMobileConfig(settings, false).agency.enabled, false)
  assert.equal(mapMobileConfig(settings, false).urge.enabled, false)
  settings.sections.urge.enabled = false
  assert.deepEqual(mapMobileConfig(settings, true).runtime.conversationFollowUpMinutes, [7, 31])
  assert.throws(() => normalizeMobileConfig({ sections: { urge: { frequency: 'wild' } } }))
  assert.throws(() => normalizeMobileConfig({ sections: { runtime: { autoAdvanceIntervalMinutes: 0 } } }))
  assert.throws(() => normalizeMobileConfig({ sections: { model: { apiKey: 'secret' } } }))
  assert.throws(() => normalizeMobileConfig({ backgroundLimit: -1 }))
})

test('rolling budget persists across restart, clock rollback and concurrent manual work', async () => {
  let clock = 100000000
  const file = join(mkdtempSync(join(tmpdir(), 'hds-budget-')), 'budget.json')
  let budget = new BackgroundBudget(file, 2, () => clock)
  budget.beforeRequest(); budget.beforeRequest()
  assert.throws(() => budget.beforeRequest(), /预算/)
  budget = new BackgroundBudget(file, 2, () => clock)
  assert.equal(budget.status().exhausted, true)
  clock -= 1000; assert.throws(() => budget.beforeRequest())
  budget.beforeRequest(true)
  await budget.runManual(async () => { await Promise.resolve(); budget.beforeRequest() })
  assert.equal(budget.status().used, 2)
  assert.throws(() => budget.beforeRequest())
  clock += 86401000
  budget.beforeRequest(); assert.equal(budget.status().used, 1)
})

test('preset sync filters secrets and unsupported switches; rechecks remote revision', async () => {
  const payload = { model: { apiKey: 'secret', endpoint: 'https://evil.invalid' }, runtime: { autoAdvanceEnabled: true, conversationFollowUpMinutes: [8, 16] }, urge: { enabled: true, apiKey: 'hidden' }, qzone: { enabled: true }, mainPrompt: 'override', alterSystem: { baseThreshold: 12 } }
  const current = { backgroundLimit: 42, sections: { agency: { contactMode: 'balanced' } } }
  const result = mobilePreset(payload, current)
  assert.equal(result.config.backgroundLimit, 42)
  assert.deepEqual(result.config.sections.agency, current.sections.agency)
  assert.equal(result.config.sections.urge.enabled, true)
  assert.doesNotMatch(JSON.stringify(result.config), /secret|hidden|evil|autoAdvanceEnabled|qzone|mainPrompt/)
  assert.throws(() => mobilePreset({ urge: { frequency: 'unknown' } }, current))
  assert.deepEqual(current.sections, { agency: { contactMode: 'balanced' } })
  let revision = 1
  const ctx = { http: { get: async (url: string) => { assert.equal(url, 'https://typ0.space/api/share/ABCDEFGH'); return { code: 'ABCDEFGH', revision, sections: Object.keys(payload), payload } } } }
  const preview = await inspectPreset(ctx as never, 'abcd-efgh', current)
  await inspectPreset(ctx as never, 'ABCDEFGH', current, preview.fingerprint)
  revision++
  await assert.rejects(() => inspectPreset(ctx as never, 'ABCDEFGH', current, preview.fingerprint), /版本已变化/)
})

test('real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers', { timeout: 60000 }, async () => {
  let calls = 0
  const api = createServer(async (request, response) => {
    for await (const _ of request) { /* drain body */ }
    calls++
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾放下书，回复朋友。', interaction: { seen: true, reply: { mode: 'immediate', content: '预算满了仍然能聊天。' } } }) } }] }))
  })
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve))
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = (reserve.address() as { port: number }).port; await new Promise<void>(resolve => reserve.close(() => resolve()))
  const config = { card: parseJsonCard(JSON.stringify({ name: '星禾', description: '朋友' })), endpoint: `http://127.0.0.1:${(api.address() as { port: number }).port}/v1/chat/completions`, model: 'fixture', userName: '我', userProfile: '', autoAdvance: false, token: 'preview8-test-token-more-than-32-chars', port, dataDir: mkdtempSync(join(tmpdir(), 'hds-eight-')), mobileConfig: { backgroundLimit: 1, sections: { urge: { enabled: true }, agency: { enabled: true } } } }
  let host: Awaited<ReturnType<typeof startHost>> | undefined
  try {
    host = await startHost(config)
    const story = (await host.dispatch('story.snapshot', {}) as any).story
    const timeline = { story, participant: null, phase: 'advance' as const, from: new Date(Date.now() - 600000), now: new Date(), scene: null, facts: [], recentEntries: [], dueIntents: [] }
    await host.app.interlude.getNarrator().planTimeline!(timeline)
    assert.equal(calls, 1)
    await assert.rejects(() => host!.app.interlude.getNarrator().planTimeline!(timeline), /预算/)
    assert.equal(calls, 1, 'Exhausted budget must stop transport')
    const status = await host.dispatch('config.status', {}) as any
    assert.equal(status.budget.used, 1); assert.equal(status.budget.exhausted, true)
    assert.equal(status.sections.urge.enabled, false)
    assert.equal((await host.dispatch('preset.syncStatus', { current: config.mobileConfig }) as any).restartRequired, false)
    assert.equal((await host.dispatch('preset.syncStatus', { current: { backgroundLimit: 2 } }) as any).restartRequired, true)
    await assert.rejects(() => host!.dispatch('preset.sync', { code: '../bad' }), /分享码/)
    await host.stop(); host = await startHost(config)
    assert.equal((await host.dispatch('config.status', {}) as any).budget.used, 1)
    await host.dispatch('messages.sendLocal', { requestId: 'preview8-message-001', content: '你好' })
    const deadline = Date.now() + 20000
    while (Date.now() < deadline && !(await host.dispatch('messages.history', {}) as any[]).some(row => row.direction === 'character')) await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok((await host.dispatch('messages.history', {}) as any[]).some(row => row.content === '预算满了仍然能聊天。'))
    assert.equal((await host.dispatch('config.status', {}) as any).budget.used, 1)
  } finally { await host?.stop(); await new Promise<void>(resolve => api.close(() => resolve())) }
})
