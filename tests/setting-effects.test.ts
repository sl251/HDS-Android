import assert from 'node:assert/strict'
import test from 'node:test'
import { settingEffects, settingEffectLabels } from '../apps/mobile-ui/setting-effects'

test('setting effects describe actual rendering, runtime reload and memory behavior', () => {
  assert.deepEqual(settingEffects, {
    appearance: { affects: 'render', timing: 'immediate' },
    notifications: { affects: 'render', timing: 'immediate' },
    life: { affects: 'schedule', timing: 'restart' },
    models: { affects: 'llm', timing: 'restart' },
    identity: { affects: 'llm', timing: 'restart' },
    memory: { affects: 'llm', timing: 'nextReply' },
  })
  assert.equal(settingEffectLabels[settingEffects.appearance.timing], '改动立即生效')
  assert.equal(settingEffectLabels[settingEffects.memory.timing], '下次回复生效')
  assert.equal(settingEffectLabels[settingEffects.models.timing], '重启核心后生效')
  assert.equal(settingEffectLabels[settingEffects.life.timing], '重启核心后生效')
})
