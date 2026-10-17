import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
const browser = await chromium.launch({ executablePath: process.env.HDS_BROWSER || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const fixture = window.exportFixture = { setting: { character: { name: '星禾', profile: '当前故事的人设' }, world: '海边', apiKey: 'SECRET', endpoint: 'https://secret.example', token: 'SECRET_TOKEN' }, delay: 0 }
    const prefs = { providers: [], modelOptions: {}, activeCard: 'first', userName: '我', userProfile: '', autoAdvance: false, mobileConfig: { sections: { agency: { enabled: true, apiKey: 'CONFIG_SECRET' } } } }
    window.androidBridge = {}
    window.Capacitor = { PluginHeaders: [{ name: 'HdsRuntime', methods: ['settings', 'cards', 'status', 'rpc', 'notificationLaunch', 'voiceState', 'appearance', 'notificationSettings', 'syncStickerLibrary'].map(name => ({ name, rtype: 'promise' })) }], nativePromise: async (_, method, payload) => {
      if (method === 'settings') return prefs
      if (method === 'cards') return { cards: [{ id: 'first', card: { name: '旧角色名', format: 'v2', description: '旧人设', warnings: [] } }] }
      if (method === 'status') return { state: 'healthy', running: true, installed: true, logs: [], device: {} }
      if (method === 'appearance') return { font: 'default', fontSize: 14, backgroundOpacity: 35, panelOpacity: 92, backgroundBlur: 0, theme: 'system' }
      if (method === 'voiceState') return { voices: [], characters: {}, defaultVoiceId: '', credentialPresent: false }
      if (method === 'notificationSettings') return { enabled: false, permission: 'denied', available: false }
      if (method === 'rpc') {
        if (payload.method === 'story.snapshot') { await new Promise(resolve => setTimeout(resolve, fixture.delay)); if (fixture.error) throw new Error(fixture.error); return { data: { story: { status: 'active', setting: structuredClone(fixture.setting) }, entries: [], facts: [], memories: [], promptTrace: [] } } }
        if (['messages.history', 'qq.conversations'].includes(payload.method)) return { data: [] }
        return { data: {} }
      }
      return {}
    } }
  })
  await page.goto(process.env.HDS_UI_URL || 'http://127.0.0.1:5173')
  await page.getByRole('button', { name: '切换角色或故事', exact: true }).click()
  await page.getByRole('button', { name: '导入、创建与管理角色', exact: true }).click()
  await page.getByRole('button', { name: '导出', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '导出角色', exact: true })
  const exportButton = dialog.getByRole('button', { name: '导出', exact: true })
  assert.equal(await dialog.getByRole('button', { name: '关闭导出' }).evaluate(element => element === document.activeElement), true)
  assert.equal(await dialog.getByRole('radio', { name: /SillyTavern/ }).isChecked(), true)
  await page.evaluate(() => { window.exportFixture.delay = 600 })
  await exportButton.click()
  assert.equal(await dialog.getByRole('button', { name: '正在导出…' }).isDisabled(), true)
  assert.equal(await page.evaluate(() => window.hdsHandleBack()), true)
  await dialog.getByRole('status').filter({ hasText: 'opfs:/hds-exports/星禾-st-v2.json' }).waitFor()
  const content = dialog.getByLabel('导出内容', { exact: true })
  const card = JSON.parse(await content.inputValue())
  assert.equal(card.spec, 'chara_card_v2'); assert.equal(card.data.name, '星禾'); assert.equal(card.data.description, '当前故事的人设')
  assert.doesNotMatch(await content.inputValue(), /apiKey|endpoint|token|SECRET/i)
  assert.equal(await page.evaluate(async () => { const root = await navigator.storage.getDirectory(); const directory = await root.getDirectoryHandle('hds-exports'); return (await (await directory.getFileHandle('星禾-st-v2.json')).getFile()).text() }), await content.inputValue())
  await dialog.getByRole('button', { name: '复制内容', exact: true }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await content.inputValue())
  await dialog.getByRole('radio', { name: /HDSI 预设 JSON/ }).check()
  assert.equal(await content.count(), 0)
  await exportButton.click(); await dialog.getByRole('status').filter({ hasText: '星禾-hdsi.json' }).waitFor()
  const preset = JSON.parse(await content.inputValue())
  assert.equal(preset.storyDefaults.characterProfile, '当前故事的人设'); assert.deepEqual(preset.agency, { enabled: true })
  await dialog.getByRole('radio', { name: /YAML 视图/ }).check()
  await exportButton.click(); await dialog.getByRole('status').filter({ hasText: '星禾-hdsi.yaml' }).waitFor()
  assert.deepEqual(parse(await content.inputValue()), preset)
  await page.evaluate(() => { window.exportFixture.error = '测试：读取失败' })
  await exportButton.click(); await dialog.getByRole('alert').getByText('测试：读取失败', { exact: true }).waitFor()
  assert.equal(await content.count(), 0)
  await page.evaluate(() => { delete window.exportFixture.error; navigator.storage.getDirectory = async () => { throw new Error('测试：磁盘写入失败') } })
  await exportButton.click(); await dialog.getByRole('alert').getByText('测试：磁盘写入失败', { exact: true }).waitFor()
  assert.equal(parse(await content.inputValue()).storyDefaults.characterName, '星禾')
  await dialog.getByRole('button', { name: '复制内容' }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await content.inputValue())
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
  const downloadEvent = page.waitForEvent('download')
  await page.evaluate(async () => { const { createCharacterExport, saveCharacterExport } = await import('/apps/mobile-ui/character-export.ts'); await saveCharacterExport(createCharacterExport('tavern', window.exportFixture.setting), false) })
  const download = await downloadEvent
  assert.equal(download.suggestedFilename(), '星禾-st-v2.json')
  assert.equal(JSON.parse(await readFile(await download.path(), 'utf8')).data.description, '当前故事的人设')
  assert.deepEqual(errors, [])
  console.log('PASS character export UI: three formats, fresh snapshot, OPFS readback, clipboard, browser download, busy/back guard, inline read/write errors and Escape.')
} finally { await browser.close() }
