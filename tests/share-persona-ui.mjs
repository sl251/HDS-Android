import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Exercise the actual component with a controllable bridge, without changing the existing M0/M1/M2 fixtures.
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { LifeSettings } from './apps/mobile-ui/LifeSettings'
    const fixture = window.fixture = { calls: [], saved: [], notices: [], failApply: false, failFingerprint: false,
      patch: { character: { name: '星禾', profile: '修理师' }, world: '海边', relationship: '老朋友', perspective: '乐观', perspectives: ['珍惜日常'], location: '' },
      setting: { character: { name: '原角色', profile: '原人设' }, world: '原世界', relationship: '原关系', perspective: '原视角' } }
    const bridge = { settings: async () => ({ activeCard: 'fixture-card' }), rpc: async request => {
      fixture.calls.push(structuredClone(request))
      if (request.method === 'config.status') return { data: {} }
      if (request.method === 'preset.sync') {
        if (request.payload.fingerprint && fixture.failFingerprint) throw new Error('预设版本已变化，请重新检查差异')
        return { data: { config: { sections: { agency: { enabled: true } } }, title: '分享预设', revision: 1, code: 'ABCDEFGH', fingerprint: 'checked-revision', removed: [], changes: [], ...(fixture.patch ? { storyPatch: structuredClone(fixture.patch) } : {}) } }
      }
      if (request.method === 'story.snapshot') return { data: { story: { id: 'fixture-story', setting: structuredClone(fixture.setting) }, settingRevision: 'checked-revision' } }
      if (request.method === 'story.applySetting') {
        if (fixture.failApply) throw new Error('人设写入失败')
        if (!request.payload.operationId) throw new Error('缺少有效的人设操作编号，请升级界面')
        if (request.payload.expectedRevision !== 'checked-revision') throw new Error('故事人设已修改，请重新检查')
        fixture.setting = { ...fixture.setting, ...structuredClone(request.payload.patch) }
        return { data: fixture.setting }
      }
      if (request.method === 'preset.commit') {
        if (fixture.failApply) throw new Error('人设写入失败')
        if (request.payload.importPersona && fixture.patch) fixture.setting = { ...fixture.setting, ...structuredClone(fixture.patch) }
        return { data: { config: { sections: { agency: { enabled: true } } }, state: 'committed' } }
      }
      return { data: {} }
    } }
    function Harness() {
      const [value, setValue] = useState({})
      return <LifeSettings value={value} change={next => { fixture.saved.push(next); setValue(next) }} bridge={bridge} healthy native notify={text => fixture.notices.push(text)} />
    }
    createRoot(document.getElementById('root')).render(<Harness />)
  ` },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
})
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/app.js' ? 'application/javascript' : 'text/html; charset=utf-8')
  response.end(request.url === '/app.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script type="module" src="/app.js"></script>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch(process.env.HDS_BROWSER ? { executablePath: process.env.HDS_BROWSER, headless: true } : { channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByText('生活节奏与表达', { exact: true }).click()
  await page.getByText('从分享码同步生活配置', { exact: true }).click()
  const check = async () => {
    await page.getByLabel('typ0.space 分享码').fill('ABCDEFGH')
    await page.getByRole('button', { name: '检查预设差异', exact: true }).click()
    await page.getByText('分享预设 · 修订 1', { exact: true }).waitFor()
  }
  const apply = () => page.getByRole('button', { name: '应用到生活设置', exact: true }).click()
  const toggle = page.getByRole('checkbox', { name: '同时导入角色人设', exact: true })
  await check()
  assert.equal(await toggle.isChecked(), true)
  for (const diff of ['角色名："原角色" → "星禾"', '世界："原世界" → "海边"', '关系："原关系" → "老朋友"', '视角："原视角" → "乐观"']) await page.getByText(diff, { exact: true }).waitFor()
  assert.equal(await page.getByText(/^地点：/).count(), 0, 'Empty persona fields are omitted')
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.method === 'story.applySetting')), false)
  await apply()
  await page.waitForFunction(() => fixture.saved.length === 1)
  assert.equal(await page.evaluate(() => fixture.setting.character.name), '星禾')
  assert.deepEqual(await page.evaluate(() => fixture.calls.filter(call => ['preset.sync', 'story.applySetting'].includes(call.method)).map(call => [call.method, call.payload.fingerprint])), [['preset.sync', undefined], ['preset.sync', 'checked-revision'], ['story.applySetting', undefined]])

  await page.evaluate(() => { fixture.patch.character.name = '不应导入'; fixture.calls = [] })
  await check()
  await toggle.uncheck()
  await apply()
  await page.waitForFunction(() => fixture.saved.length === 2)
  assert.equal(await page.evaluate(() => fixture.setting.character.name), '星禾')
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.method === 'story.applySetting')), false)

  await page.evaluate(() => { fixture.patch = undefined; fixture.calls = [] })
  await check()
  assert.equal(await toggle.count(), 0, 'Life-only shares have no persona toggle')
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.method === 'story.snapshot')), false)
  await apply()
  await page.waitForFunction(() => fixture.saved.length === 3)

  await page.evaluate(() => { fixture.patch = { world: '新世界' }; fixture.failFingerprint = true; fixture.calls = [] })
  await check()
  assert.equal(await toggle.isChecked(), true, 'Each new preview defaults to importing persona')
  await apply()
  await page.waitForFunction(() => fixture.notices.at(-1).includes('版本已变化'))
  assert.equal(await page.evaluate(() => fixture.saved.length), 3)
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.method === 'story.applySetting')), false)

  await page.evaluate(() => { fixture.failFingerprint = false; fixture.failApply = true })
  await check()
  await apply()
  await page.waitForFunction(() => fixture.notices.at(-1) === '人设写入失败')
  assert.equal(await page.evaluate(() => fixture.saved.length), 3)
  assert.equal(await page.evaluate(() => fixture.setting.world), '海边')
  assert.deepEqual(errors, [])
  console.log('PASS share persona UI: before/after diff, default on, opt out, life-only, fingerprint rejection, RPC failure.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
