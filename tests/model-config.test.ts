import test from 'node:test'
import assert from 'node:assert/strict'
import { mobileModelConfig } from '../runtime/model-config'
import { resolveModelRouting } from '../upstream/hds-interlude/src/model-routing'
import type { ModelConfig } from '../upstream/hds-interlude/src/narrator'
import { visionProjection, visionRouteReason, imageEntryReason } from '../packages/contracts'
import type { ModelProvider } from '../packages/contracts'
import presets from '../android/app/src/main/assets/model-presets.json'

const row = (id: string, roles: Partial<ModelProvider>): ModelProvider => ({ id, preset: 'custom', label: id, endpoint: 'https://example.com/v1/chat/completions', model: id, protocol: 'chat-completions', enabled: true, credentialPresent: false, useForMain: false, useForCompaction: false, useForAlter: false, ...roles })
test('mobile assignments drive the original HDS main, compaction, timeline and Alter routes', () => {
  const config = mobileModelConfig({ endpoint: '', model: '', providers: [row('writer', { useForMain: true }), row('memory', { useForCompaction: true }), row('emotion', { useForAlter: true })], modelOptions: { mainStreamingMode: 'experimental', mainMaxTokens: 8192, mainTimeout: 120000, failoverEnabled: true, failoverStrategy: 'round-robin' } })
  const routing = resolveModelRouting(config as ModelConfig)
  assert.equal(routing.main.providers[0].model, 'writer')
  assert.equal(routing.compaction.providers[0].model, 'memory')
  assert.equal(routing.timeline.providers[0].model, 'memory')
  assert.equal(routing.alter.providers[0].model, 'emotion')
  assert.equal(config.mainStreamingMode, 'experimental'); assert.equal(config.mainMaxTokens, 8192)
  assert.equal(config.failover!.strategy, 'round-robin')
})
test('legacy single connection retains all roles; empty assignments never silently route to another task', () => {
  assert.equal(mobileModelConfig({ endpoint: 'https://example.com/v1/chat/completions', model: 'old', apiKey: 'key' }).providers[0].useForAlter, true)
  assert.throws(() => mobileModelConfig({ endpoint: '', model: '', providers: [row('writer', { useForMain: true })] }), /useForCompaction/)
  assert.throws(() => mobileModelConfig({ endpoint: 'https://example.com/v1/chat/completions', model: 'old', modelOptions: { mainStreamingMode: 'experimental', mainResponseFormat: 'prompt-only' } }), /JSON/)
})
test('official preset addresses agree with the embedded upstream HDS resolver', () => {
  for (const preset of presets.filter(item => item.id !== 'custom')) {
    const config = mobileModelConfig({ endpoint: '', model: '', providers: [{ ...row('primary', { useForMain: true, useForCompaction: true, useForAlter: true }), ...preset, id: 'primary', model: 'fixture' } as ModelProvider] })
    const route = resolveModelRouting(config as ModelConfig).main.providers[0]
    assert.equal(route.endpoint, preset.endpoint, preset.id)
    assert.equal(route.protocol, preset.protocol, preset.id)
  }
})

test('vision projection is canonical, secret-free and checks every candidate', () => {
  const writer = row('writer', { useForMain: true, imageInput: 'supported' })
  const base = { providers: [writer], modelOptions: { visionEnabled: true } }
  assert.deepEqual(visionProjection(base), visionProjection({ modelOptions: { visionEnabled: true }, providers: [{ ...writer, endpoint: 'https://example.com/v1/', apiKey: 'TEST_SECRET' }] }))
  assert.doesNotMatch(JSON.stringify(visionProjection(base)), /apiKey|credential/)
  assert.equal(visionRouteReason(visionProjection(base)), undefined)
  for (const imageInput of ['unknown', 'unsupported'] as const) {
    assert.ok(visionRouteReason(visionProjection({ ...base, providers: [writer, row('fallback', { useForMain: true, imageInput })] })))
  }
  assert.equal(visionRouteReason(visionProjection({ providers: [row('text', { useForMain: true }), writer], modelOptions: { visionEnabled: true, visionProviderId: 'writer' } })), undefined)
  assert.throws(() => mobileModelConfig({ endpoint: '', model: '', providers: [row('bad', { imageInput: 'invalid' as any })] }), /能力/)
})
test('image entry explains all unavailable states in priority order', () => {
  const input = { native: true, healthy: true, busy: false, sending: false, count: 0, enabled: true }
  assert.equal(imageEntryReason(input), undefined)
  for (const patch of [{ native: false }, { healthy: false }, { busy: true }, { sending: true }, { count: 3 }, { enabled: false }]) assert.ok(imageEntryReason({ ...input, ...patch }))
})
