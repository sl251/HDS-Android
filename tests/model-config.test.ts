import test from 'node:test'
import assert from 'node:assert/strict'
import { mobileModelConfig } from '../runtime/model-config'
import { resolveModelRouting } from '../upstream/hds-interlude/src/model-routing'
import type { ModelConfig } from '../upstream/hds-interlude/src/narrator'
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
