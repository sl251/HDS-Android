import test from 'node:test'
import assert from 'node:assert/strict'
import { assignTask, assigned, removeProvider, assignEmbedding, embeddingProviderId, toggleTaskProvider } from '../apps/mobile-ui/model-tasks'
import { defaultOptions } from '../apps/mobile-ui/ModelCenter'
import type { ModelSettings } from '../packages/contracts'
import { mobileModelConfig } from '../runtime/model-config'
import { resolveModelRouting } from '../upstream/hds-interlude/src/model-routing'
import type { ModelConfig } from '../upstream/hds-interlude/src/narrator'
import type { ModelProvider } from '../packages/contracts'

const row = (id: string, all = false): ModelProvider => ({ id, label: id, preset: 'custom', model: id, endpoint: 'https://example.com/v1', protocol: 'chat-completions', enabled: true, credentialPresent: false, useForMain: all, useForCompaction: all, useForAlter: all })
test('task board follows the main model and preserves an independent psychology model in HDS routing', () => {
  let rows = [row('writer', true), row('new-writer'), row('psychology')]
  rows = assignTask(rows, 'useForAlter', 'psychology')
  rows = assignTask(rows, 'useForMain', 'new-writer')
  const config = mobileModelConfig({ endpoint: '', model: '', providers: rows })
  const routes = resolveModelRouting(config as ModelConfig)
  assert.equal(routes.main.providers[0].model, 'new-writer')
  assert.equal(routes.compaction.providers[0].model, 'new-writer')
  assert.equal(routes.alter.providers[0].model, 'psychology')
  rows = assignTask(rows, 'useForAlter', 'inherit')
  assert.deepEqual(assigned(rows, 'useForAlter'), ['new-writer'])
})
test('deleting the assigned provider repairs orphaned tasks without using disabled connections', () => {
  const rows = removeProvider([row('old', true), { ...row('disabled'), enabled: false }, row('new')], 'old')
  for (const task of ['useForMain', 'useForCompaction', 'useForAlter'] as const) assert.deepEqual(assigned(rows, task), ['new'])
  assert.doesNotThrow(() => mobileModelConfig({ endpoint: '', model: '', providers: rows }))
})
test('legacy multi-model task sets can be inherited without discarding backup providers', () => {
  let rows = [row('first', true), row('backup', true), row('other')]
  rows = assignTask(rows, 'useForCompaction', 'other')
  rows = assignTask(rows, 'useForCompaction', 'inherit')
  assert.deepEqual(assigned(rows, 'useForCompaction'), ['first', 'backup'])
})

test('the embedding selector preserves legacy explicit overrides and synchronizes one ownership choice', () => {
  const settings: ModelSettings = { providers: [{ ...row('legacy'), useForEmbedding: true }, row('explicit'), row('replacement')], modelOptions: defaultOptions, userName: '', userProfile: '', autoAdvance: false,
    mobileConfig: { sections: { embedding: { enabled: true, providerId: 'explicit', model: 'embedding-v2', endpoint: 'https://example.com/v1/embeddings', dimensions: 1024 }, rerank: { providerId: 'legacy', model: 'ranker' } } } }
  assert.equal(embeddingProviderId(settings), 'explicit')
  const next = assignEmbedding(settings, 'replacement')
  assert.equal(embeddingProviderId(next), 'replacement')
  assert.deepEqual(assigned(next.providers, 'useForEmbedding'), ['replacement'])
  assert.deepEqual(next.mobileConfig?.sections?.embedding, { ...settings.mobileConfig?.sections?.embedding, providerId: 'replacement' })
  assert.deepEqual(next.mobileConfig?.sections?.rerank, settings.mobileConfig?.sections?.rerank)
  assert.equal(embeddingProviderId(assignEmbedding(next, '')), '')
  assert.equal(embeddingProviderId({ ...settings, mobileConfig: {} }), 'legacy')
  assert.equal(embeddingProviderId({ ...settings, mobileConfig: {}, providers: [{ ...row('legacy'), enabled: false, useForEmbedding: true }] }), '')
})

test('task-local backups keep inherited roles together and preserve independent assignments', () => {
  const settings: ModelSettings = { providers: [{ ...row('main', true), useForAlter: false }, row('backup'), { ...row('psychology'), useForAlter: true }], modelOptions: defaultOptions, userName: '', userProfile: '', autoAdvance: false }
  const next = toggleTaskProvider(settings, 'useForMain', 'backup', true)
  assert.deepEqual(assigned(next.providers, 'useForCompaction'), ['main', 'backup'])
  assert.deepEqual(assigned(next.providers, 'useForAlter'), ['psychology'])
  assert.equal(next.modelOptions.failoverEnabled, true)
  assert.deepEqual(assigned(toggleTaskProvider(next, 'useForMain', 'backup', false).providers, 'useForCompaction'), ['main'])
})
