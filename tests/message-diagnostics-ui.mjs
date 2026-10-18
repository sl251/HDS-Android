import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { characterFixture } from './character-io-fixture.mjs'

const f = await characterFixture(true), { page } = f
await mkdir('artifacts/media-controls', { recursive: true })
try {
  await page.addInitScript(() => {
    const bridge = window.Capacitor, original = bridge.nativePromise
    bridge.PluginHeaders[0].methods.push({ name: 'saveMessageDiagnostics', rtype: 'promise' })
    fixture.diagnosticEvents = Array.from({ length: 125 }, (_, n) => ({ id: `fixture-event-${n}`, at: Date.now(), requestIds: ['fixture-request-first'], stage: 'model', outcome: 'failed', reason: 'provider_quota', providerSlot: 1 }))
    bridge.nativePromise = async (plugin, method, options) => {
      if (method === 'status') return { state: 'healthy', installed: true, environmentState: 'ready', running: true, logs: [], device: {} }
      if (method === 'saveMessageDiagnostics') { fixture.exportFilter = options; return { cancelled: true } }
      if (method === 'rpc') {
        if (options.method === 'diagnostics.messages') return { data: { events: fixture.diagnosticEvents, storageAvailable: true } }
        if (options.method === 'diagnostics.clear') { fixture.diagnosticEvents = []; fixture.cleared = true; return { data: { cleared: true } } }
        if (options.method === 'messages.history') return { data: [{ id: 'fixture-request-first', direction: 'user', content: '诊断测试消息', status: 'accepted', occurredAt: new Date().toISOString() }] }
        return { data: {} }
      }
      return original(plugin, method, options)
    }
  })
  await f.load()
  await page.getByRole('button', { name: '故事', exact: true }).click()
  await page.getByText('诊断测试消息', { exact: true }).waitFor()
  await page.getByText('诊断测试消息', { exact: true }).click({ button: 'right' })
  const dialog = page.getByRole('dialog', { name: '消息诊断', exact: true })
  await dialog.waitFor()
  assert.equal(await dialog.getByLabel('查看范围').inputValue(), 'fixture-request-first')
  assert.equal(await dialog.locator('ol > li').count(), 100)
  await dialog.getByRole('button', { name: /显示更早记录/ }).click()
  assert.equal(await dialog.locator('ol > li').count(), 125)
  await dialog.getByRole('button', { name: '导出脱敏记录' }).click()
  await page.waitForFunction(() => fixture.exportFilter?.messageId === 'fixture-request-first')
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByRole('button', { name: /^消息诊断/ }).click()
  for (const width of [320, 360, 390, 740]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844)
    await page.screenshot({ path: `artifacts/media-controls/diagnostics-${width}.png` })
  }
  await dialog.getByRole('button', { name: '关闭消息诊断' }).focus()
  await page.keyboard.press('Shift+Tab')
  assert.equal(await dialog.getByRole('button', { name: /显示更早记录/ }).evaluate(element => element === document.activeElement), true)
  await dialog.getByRole('button', { name: '清空本故事记录' }).click()
  await dialog.getByRole('button', { name: '确认清空', exact: true }).click()
  await page.waitForFunction(() => fixture.cleared)
  await dialog.getByText('这个范围没有保留的记录。').waitFor()
  assert.equal(await page.evaluate(() => window.hdsHandleBack()), true)
  await dialog.waitFor({ state: 'detached' })
  assert.deepEqual(f.errors, [])
  console.log('PASS message diagnostics: message context, pagination, export filter, 320/360/390/740 layouts, focus, clear and native back.')
} finally { await f.close() }
