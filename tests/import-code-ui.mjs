import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Bundle the real App in memory; no Vite/APK build or running story is needed.
const bundle = await build({ entryPoints: ['apps/mobile-ui/main.tsx'], bundle: true, write: false, format: 'esm', platform: 'browser', loader: { '.css': 'empty' }, tsconfig: 'tsconfig.json' })
const share = { code: 'ABCDEFGH', title: '休息时的预览', revision: 1, sections: ['agency', 'storyDefaults'], payload: { agency: { enabled: true }, storyDefaults: { characterName: '星禾', characterProfile: '修理师' } } }
const fingerprint = createHash('sha256').update(JSON.stringify([share.code, share.revision, share.payload])).digest('hex')
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/app.js' ? 'application/javascript' : 'text/html; charset=utf-8')
  response.end(request.url === '/app.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script type="module" src="/app.js"></script>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.HDS_BROWSER || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  await page.addInitScript(({ share, fingerprint }) => {
    const card = { name: '星禾', description: '修理师', format: 'v2', warnings: [] }
    const fixture = window.fixture = {
      calls: [], saved: [], share, fingerprint, notification: '', hold: false, release: null,
      settings: { activeCard: new URL(location.href).searchParams.get('selected') ?? 'first', providers: [], modelOptions: {}, mobileConfig: {}, userName: '我', userProfile: '', autoAdvance: false },
      status: { state: 'stopped', installed: true, environmentState: 'ready', running: false, logs: [], device: {} },
    }
    const methods = ['settings', 'saveSettings', 'cards', 'status', 'appearance', 'notificationSettings', 'notificationLaunch', 'voiceState', 'rpc', 'selectCard']
    window.androidBridge = {}
    window.Capacitor = {
      PluginHeaders: [{ name: 'HdsRuntime', methods: methods.map(name => ({ name, rtype: 'promise' })) }, { name: 'CapacitorHttp', methods: [{ name: 'get', rtype: 'promise' }] }],
      nativePromise: async (plugin, method, options) => {
        fixture.calls.push({ plugin, method, options: structuredClone(options) })
        if (plugin === 'CapacitorHttp') {
          if (fixture.hold) await new Promise(resolve => { fixture.release = resolve })
          return { status: 200, data: fixture.share, headers: {}, url: options.url }
        }
        if (method === 'settings') return fixture.settings
        if (method === 'saveSettings') { fixture.saved.push(options); Object.assign(fixture.settings, options); return {} }
        if (method === 'cards') return { cards: ['first', 'second'].map(id => ({ id, card })) }
        if (method === 'selectCard') { fixture.settings.activeCard = options.id; return {} }
        if (method === 'status') return fixture.status
        if (method === 'appearance') return { font: 'default', fontSize: 14, backgroundOpacity: 35, panelOpacity: 92, backgroundBlur: 0, theme: 'light' }
        if (method === 'notificationSettings') return { enabled: false, permission: 'prompt', available: false }
        if (method === 'notificationLaunch') { const cardId = fixture.notification; fixture.notification = ''; return { cardId } }
        if (method === 'voiceState') return { voices: [], characters: {} }
        if (method === 'rpc') {
          if (fixture.status.state !== 'healthy') throw new Error('请先启动 HDS')
          if (options.method === 'preset.sync') {
            if (options.payload.fingerprint !== fixture.fingerprint) throw new Error('预设版本已变化，请重新检查差异')
            return { data: { config: { sections: { agency: { enabled: true } } }, storyPatch: { character: { name: '星禾', profile: '修理师' } } } }
          }
          if (options.method === 'preset.commit') { fixture.settings.mobileConfig = { sections: { agency: { enabled: true } } }; return { data: { config: fixture.settings.mobileConfig, state: 'committed' } } }
          if (options.method === 'messages.history' || options.method === 'qq.conversations') return { data: [] }
          return { data: {} }
        }
        return {}
      },
    }
  }, { share, fingerprint })
  const load = async selected => {
    await page.goto(`http://127.0.0.1:${server.address().port}/?selected=${selected}`)
    await page.getByRole('button', { name: '切换角色或故事', exact: true }).click()
    await page.getByRole('button', { name: '导入、创建与管理角色', exact: true }).click()
    await page.getByRole('button', { name: '用导入码导入', exact: true }).click()
    await page.getByLabel('typ0.space 导入码').fill('ABCDEFGH')
  }
  const dialog = page.getByRole('dialog', { name: '用导入码同步' })
  const check = dialog.getByRole('button', { name: '检查', exact: true })
  const apply = dialog.getByRole('button', { name: '应用到当前故事' })
  const preview = async () => { await check.click(); await dialog.getByText('休息时的预览 · 修订 1').waitFor() }
  await load('')
  await dialog.getByText('请先选择角色，再检查导入码。').waitFor()
  assert.equal(await check.isDisabled(), true)
  await load('first')
  await dialog.getByText('可以先检查预览，应用前需要唤醒故事。').waitFor()
  await preview()
  assert.equal(await apply.isDisabled(), true)
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.method === 'rpc' && call.options.method === 'preset.sync')), false)
  // Waking this story does not increment profileRevision. The resting preview's
  // revision remains valid and its original fingerprint must reach the host.
  await page.evaluate(() => { fixture.status.state = 'healthy' })
  await page.waitForFunction(() => !document.querySelector('.modal .primary.wide')?.disabled)
  await apply.click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => fixture.calls.find(call => call.options?.method === 'preset.sync').options.payload.fingerprint), fingerprint)
  assert.equal(await page.evaluate(() => fixture.calls.filter(call => call.options?.method === 'preset.commit').length), 1)

  // A different story changes profileRevision after the preview was cached.
  await load('first'); await preview()
  await page.evaluate(() => { fixture.notification = 'second' })
  await page.waitForFunction(() => fixture.settings.activeCard === 'second')
  await page.evaluate(() => { fixture.status.state = 'healthy' })
  await page.waitForFunction(() => !document.querySelector('.modal .primary.wide')?.disabled)
  await apply.click()
  await dialog.getByRole('alert').getByText('当前故事已变化，请重新检查。').waitFor()
  assert.equal(await page.evaluate(() => fixture.calls.some(call => call.options?.method === 'preset.sync')), false)
  await preview(); await apply.click(); await dialog.waitFor({ state: 'detached' })

  // Revision is captured before the network request, not when it completes.
  await load('first')
  await page.evaluate(() => { fixture.hold = true })
  await check.click()
  await page.waitForFunction(() => fixture.release !== null)
  await page.evaluate(() => { fixture.notification = 'second' })
  await page.waitForFunction(() => fixture.settings.activeCard === 'second')
  await page.evaluate(() => fixture.release())
  await dialog.getByRole('alert').getByText('当前故事或运行状态已变化，请重新检查。').waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS import code App UI: selected/resting gates, hostless preview, wake/apply, cached revision invalidation, revision captured before fetch.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
