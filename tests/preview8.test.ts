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

test('mobile alter output budget defaults to 400 and respects explicit user settings', () => {
  for (const autoAdvance of [false, true]) {
    assert.equal(mapMobileConfig(undefined, autoAdvance).alterSystem.maxTokens, 400)
    assert.equal(mapMobileConfig({ sections: { alterSystem: { enabled: true } } }, autoAdvance).alterSystem.maxTokens, 400)
    for (const maxTokens of [128, 400, 2000]) assert.equal(mapMobileConfig({ sections: { alterSystem: { maxTokens } } }, autoAdvance).alterSystem.maxTokens, maxTokens)
  }
})

test('mobile context budget is explicit and cannot be injected through settings or preset sync', () => {
  for (const autoAdvance of [false, true]) {
    for (const config of [undefined, { sections: { runtime: { sweepIntervalMinutes: 2 } } }]) {
      const mapped = mapMobileConfig(config, autoAdvance)
      assert.equal(mapped.runtime.contextEntryLimit, 20)
      assert.equal(mapped.runtime.contextTimeWindowMinutes, 10)
    }
  }
  const runtimeFields = mobileSchema().sections.find(section => section.key === 'runtime')!.fields.map(field => field.key)
  for (const field of ['contextEntryLimit', 'contextTimeWindowMinutes']) {
    assert.ok(!runtimeFields.includes(field))
    assert.throws(() => normalizeMobileConfig({ sections: { runtime: { [field]: 500 } } }), /不支持的配置字段/)
  }
  const preset = mobilePreset({ runtime: { contextEntryLimit: 200, contextTimeWindowMinutes: 1440, sweepIntervalMinutes: 2 } }, {})
  assert.deepEqual(preset.config.sections.runtime, { sweepIntervalMinutes: 2 })
  assert.equal(mapMobileConfig(preset.config, true).runtime.contextEntryLimit, 20)
  assert.equal(mapMobileConfig(preset.config, true).runtime.contextTimeWindowMinutes, 10)
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
    assert.equal(host.app.interlude.config.runtime.contextEntryLimit, 20)
    assert.equal(host.app.interlude.config.runtime.contextTimeWindowMinutes, 10)
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

test('rc57 mobile patches apply LF and CRLF fixtures, are idempotent and reject unknown anchors', async () => {
  // Import is read-only; use isolated strings/temporary source files, never mutate vendored sources.
  const { mobilePatches, mobileTestPatches, applyMobilePatches, patchMobile } = await import('../scripts/patch-mobile-hds.mjs')
  const { writeFileSync, rmSync } = await import('node:fs')
  const directory = mkdtempSync(join(tmpdir(), 'hds-patch81-'))
  try {
    for (const [name, patches] of Object.entries(mobilePatches) as [string, { before: string; after: string }[]][]) {
      const actual = readFileSync(`upstream/hds-interlude/src/${name}`, 'utf8').replace(/\r\n/g, '\n')
      let baseline = actual
      for (const patch of [...patches].reverse()) { assert.ok(baseline.includes(patch.after)); baseline = baseline.replace(patch.after, () => patch.before) }
      const applied = applyMobilePatches(baseline, name)
      assert.equal(applied, actual, name)
      assert.equal(applyMobilePatches(baseline.replace(/\n/g, '\r\n'), name), actual)
      assert.equal(applyMobilePatches(applied, name), applied)
      assert.throws(() => applyMobilePatches(baseline.replace(patches[0].before, 'unknown-source'), name), /unknown\/ambiguous anchor/)
      writeFileSync(join(directory, name), baseline)
    }
    for (const [name, patches] of Object.entries(mobileTestPatches) as [string, { before: string; after: string }[]][]) {
      const actual = readFileSync(`upstream/hds-interlude/test/${name}`, 'utf8').replace(/\r\n/g, '\n')
      let baseline = actual
      for (const patch of [...patches].reverse()) baseline = baseline.replace(patch.after, () => patch.before)
      assert.equal(applyMobilePatches(baseline, name, mobileTestPatches), actual)
      assert.equal(applyMobilePatches(actual, name, mobileTestPatches), actual)
    }
    writeFileSync(join(directory, 'endpoints.ts'), readFileSync('upstream/hds-interlude/src/endpoints.ts', 'utf8'))
    patchMobile(directory)
    const first = readFileSync(join(directory, 'service.ts'), 'utf8')
    patchMobile(directory)
    assert.equal(readFileSync(join(directory, 'service.ts'), 'utf8'), first)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
test('Preview 8.1 thresholds keep defaults and independent explicit-contact settings', () => {
  const fields = mobileSchema().sections.find(section => section.key === 'runtime')!.fields
  assert.equal(fields.find(field => field.key === 'minimumFollowUpCommitmentSeconds')!.default, 300)
  assert.equal(fields.find(field => field.key === 'sweepIntervalMinutes')!.default, 5)
  for (const minimum of [10, 300, 43200]) {
    const source = { sections: { runtime: { minimumFollowUpCommitmentSeconds: minimum, sweepIntervalMinutes: 1 } } }
    assert.equal(mapMobileConfig(source, false).runtime.minimumFollowUpCommitmentSeconds, minimum)
    assert.deepEqual(normalizeMobileConfig(source).sections.runtime, source.sections.runtime)
  }
  for (const minimum of [9, 43201, 10.5]) assert.throws(() => normalizeMobileConfig({ sections: { runtime: { minimumFollowUpCommitmentSeconds: minimum } } }))
})
