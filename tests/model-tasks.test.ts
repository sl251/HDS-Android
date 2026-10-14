import test from 'node:test'
import assert from 'node:assert/strict'
import { assignTask, assigned, removeProvider } from '../apps/mobile-ui/model-tasks'
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
