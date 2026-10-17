import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mobileSchema, normalizeMobileConfig, mapMobileConfig } from '../runtime/mobile-config'
import { Config } from '../upstream/hds-interlude/src/index'
import { storySettingPatch } from '../apps/mobile-ui/StorySettingEditor'
import { mobileModelConfig } from '../runtime/model-config'
import { assignTask } from '../apps/mobile-ui/model-tasks'

const defaults = {
  schedulePreplan: { enabled: true, horizonDays: 14, variationLevel: 'stable', candidateActivationProbability: .25, candidateRevealMinutes: 120, reviewAfterLocalHour: 3, anchorAutoAdvance: true },
  timelineDirector: { enabled: true },
  memory: { enabled: true, backgroundIntervalMinutes: 10, sceneEntryThreshold: 16, sceneCharacterThreshold: 10000, recentEntryLimit: 20, factLimit: 20 },
  worldSeeder: { enabled: false, cadenceMinutes: 30, maxPending: 6, dailyCap: 8, maxHorizonHours: 72, temperature: .9, maxTokens: 1000, timeout: 60000 },
  longHorizon: { enabled: false, triggerScore: 25, reviewIncrement: 40, intensity: 'subtle' },
  weather: { enabled: false, latitude: 39.14, longitude: 117.18, autoFromLocation: true, skipFantasyWorld: false, cadenceMinutes: 30 },
}
for (const [key, expected] of Object.entries(defaults)) {
  test(`M4 ${key}: supported schema, rc56 defaults and explicit mobile mapping`, () => {
    const schema = mobileSchema().sections.find(row => row.key === key)!
    assert.deepEqual(Object.fromEntries(schema.fields.map(field => [field.key, field.default])), expected)
    for (const auto of [false, true]) {
      const mapped = mapMobileConfig(undefined, auto) as any
      assert.deepEqual(mapped[key], expected)
      const configured = mapMobileConfig({ sections: { [key]: { enabled: !expected.enabled } } }, auto) as any
      assert.deepEqual(configured[key], { ...expected, enabled: !expected.enabled })
    }
    assert.deepEqual(normalizeMobileConfig({ sections: { [key]: expected } }).sections[key], expected)
    for (const field of schema.fields) {
      if (key === 'memory' && ['recentEntryLimit', 'factLimit'].includes(field.key)) continue
      assert.equal(field.default, (Config as any).dict[key].dict[field.key].meta.default, `${key}.${field.key} follows rc56`)
    }
    assert.throws(() => normalizeMobileConfig({ sections: { [key]: { enabled: 'yes' } } }))
    assert.throws(() => normalizeMobileConfig({ sections: { [key]: { unsupported: true } } }))
  })
}

test('M4 mobile memory safety caps and six-section schema reject invalid values', () => {
  for (const key of ['recentEntryLimit', 'factLimit']) {
    const field = mobileSchema().sections.find(row => row.key === 'memory')!.fields.find(field => field.key === key)!
    assert.equal(field.max, 20)
    for (const count of [0, 21, 200, 1.5]) assert.throws(() => normalizeMobileConfig({ sections: { memory: { [key]: count } } }))
  }
  for (const sections of [
    { schedulePreplan: { horizonDays: 31 } }, { schedulePreplan: { variationLevel: 'random' } },
    { worldSeeder: { cadenceMinutes: 4 } }, { worldSeeder: { maxPending: 21 } },
    { longHorizon: { intensity: 'extreme' } }, { longHorizon: { reviewIncrement: 9 } },
    { weather: { latitude: 91 } },
  ]) assert.throws(() => normalizeMobileConfig({ sections }))
  assert.deepEqual(JSON.parse(readFileSync('packages/contracts/mobile-config.schema.json', 'utf8')), JSON.parse(JSON.stringify(mobileSchema())))
  assert.equal(readFileSync('packages/contracts/mobile-config.schema.json', 'utf8'), readFileSync('android/app/src/main/assets/mobile-config.schema.json', 'utf8'))
})

test('M4 story editor maps defaults aliases to runtime setting and validates timezone', () => {
  const draft = { character: { name: '星禾', profile: '修理师' }, world: '海边', relationship: '老朋友', perspective: '乐观', timezone: 'Asia/Tokyo', supplementaryFacts: ['有一间修理铺'] }
  assert.deepEqual(storySettingPatch(draft), draft)
  assert.throws(() => storySettingPatch({ character: { name: ' ' } }), /名称/)
  assert.throws(() => storySettingPatch({ ...draft, timezone: 'invalid/zone' }), /时区/)
})

test('M4 world-event source has an optional, independent runnable model assignment', () => {
  const row = { id: 'writer', preset: 'custom', label: 'writer', model: 'fixture', endpoint: 'https://example.com/v1', protocol: 'chat-completions' as const, enabled: true, useForMain: true, useForCompaction: true, useForAlter: true }
  const rows = assignTask([row], 'useForWorldSeeding', 'writer')
  assert.equal(mobileModelConfig({ providers: rows, endpoint: row.endpoint, model: row.model }).providers[0].useForWorldSeeding, true)
  assert.equal(rows[0].useForMain, true)
  assert.equal(assignTask(rows, 'useForWorldSeeding', '')[0].useForWorldSeeding, false)
})
