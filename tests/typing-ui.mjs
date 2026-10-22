import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { characterFixture } from './character-io-fixture.mjs'

const f = await characterFixture(true), { page } = f
await mkdir('artifacts/typing-tasks', { recursive: true })
try {
  await page.addInitScript(() => {
    const original = window.Capacitor.nativePromise
    fixture.events = []; fixture.healthy = true
    fixture.cards.push({ ...structuredClone(fixture.cards[0]), id: 'second', card: { ...fixture.cards[0].card, name: '另一角色' } })
    fixture.message = { id: 'request-local', content: '今天过得怎么样？', direction: 'user', occurredAt: new Date().toISOString(), status: 'accepted' }
    window.Capacitor.nativePromise = async (plugin, method, options) => {
      if (method === 'status') return { ...(await original(plugin, method, options)), state: fixture.healthy ? 'healthy' : 'stopped', running: fixture.healthy }
      if (method === 'rpc') {
        if (options.method === 'preset.syncStatus') return { data: { visionRestartRequired: false, activeVision: { enabled: false, providers: [] } } }
        if (options.method === 'messages.history') return { data: fixture.selected === 'first' ? [fixture.message] : [] }
        if (options.method === 'qq.conversations') return { data: [] }
        if (options.method === 'diagnostics.messages') {
          if (fixture.failDiagnostics) throw new Error('unavailable')
          const events = structuredClone(fixture.selected === 'first' ? fixture.events : [])
          if (fixture.holdDiagnostics) await new Promise(resolve => { fixture.releaseDiagnostics = resolve })
          return { data: { events, storageAvailable: true } }
        }
      }
      return original(plugin, method, options)
    }
  })
  await f.load(); await page.getByRole('button', { name: '故事', exact: true }).click()
  const bubble = page.getByRole('status', { name: '已有角色正在输入', exact: true })
  const publish = async (stage, outcome) => page.evaluate(({ stage, outcome }) => {
    fixture.events.push({ id: crypto.randomUUID(), at: Date.now(), requestIds: ['request-local'], stage, outcome })
  }, { stage, outcome })
  await page.getByText('今天过得怎么样？', { exact: true }).waitFor()
  assert.equal(await bubble.count(), 0, 'A receipt is not typing')
  await publish('processing', 'started'); await bubble.waitFor()
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `artifacts/typing-tasks/typing-${width}.png` })
  }
  const samples = new Set()
  for (let index = 0; index < 12; index++) {
    samples.add(await bubble.locator('.typing-dots i').evaluateAll(dots => dots.filter(dot => getComputedStyle(dot).opacity === '1').length))
    await page.waitForTimeout(150)
  }
  assert.deepEqual([...samples].sort(), [1, 2, 3])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.ok((await bubble.locator('.typing-dots i').evaluateAll(dots => dots.map(dot => getComputedStyle(dot).animationName))).every(name => name === 'none'))
  for (const [stage, outcome] of [['delivery', 'delivered'], ['model', 'failed'], ['decision', 'none'], ['decision', 'delayed'], ['processing', 'settled'], ['lifecycle', 'interrupted']]) {
    await publish(stage, outcome); await bubble.waitFor({ state: 'detached' })
    await publish('model', 'started'); await bubble.waitFor()
  }
  await page.evaluate(() => { fixture.failDiagnostics = true }); await bubble.waitFor({ state: 'detached' })
  await page.evaluate(() => { fixture.failDiagnostics = false }); await bubble.waitFor()
  await page.evaluate(() => { fixture.holdDiagnostics = true }); await page.waitForFunction(() => !!fixture.releaseDiagnostics)
  await bubble.waitFor({ state: 'detached', timeout: 8000 })
  await page.evaluate(() => { fixture.holdDiagnostics = false; fixture.releaseDiagnostics() }); await bubble.waitFor()
  await page.evaluate(() => { fixture.healthy = false }); await bubble.waitFor({ state: 'detached' })
  await page.evaluate(() => { fixture.events = []; fixture.healthy = true })
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByRole('button', { name: '故事', exact: true }).click()
  assert.equal(await bubble.count(), 0)
  await publish('model', 'started'); await bubble.waitFor()
  await page.evaluate(() => { fixture.holdDiagnostics = true; fixture.releaseDiagnostics = null })
  await page.waitForFunction(() => !!fixture.releaseDiagnostics)
  await page.getByRole('button', { name: '切换角色或故事', exact: true }).click()
  await page.getByRole('button', { name: /另一角色.*继续故事/ }).click()
  await page.waitForFunction(() => fixture.selected === 'second')
  await page.evaluate(() => { fixture.holdDiagnostics = false; fixture.releaseDiagnostics() })
  await page.waitForTimeout(1200)
  assert.equal(await page.locator('.typing-message').count(), 0, 'An old in-flight poll cannot show typing in another story')
  assert.deepEqual(f.errors, [])
  console.log('PASS typing UI: real processing, 1/2/3 dots, reduced motion, terminal events, poll errors/hangs, runtime stop and responsive layouts')
} finally { await f.close() }
