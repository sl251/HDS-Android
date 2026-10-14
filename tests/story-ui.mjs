import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch(process.env.HDS_BROWSER ? { executablePath: process.env.HDS_BROWSER, headless: true } : { channel: 'msedge', headless: true })
await mkdir('artifacts', { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const row = (id, all) => ({ id, preset: 'custom', label: id === 'writer' ? '故事模型' : '轻量模型', endpoint: 'https://example.com/v1', model: id, protocol: 'chat-completions', enabled: true, credentialPresent: true, useForMain: all, useForCompaction: all, useForAlter: all })
    const prefs = { providers: [row('writer', true), row('light', false)], modelOptions: { mainStreamingMode: 'off', mainResponseFormat: 'json-object', mainTemperature: .8, mainMaxTokens: 4096, mainTimeout: 60000, mainPayloadOrder: 'cache-first', failoverEnabled: false, failoverStrategy: 'priority' }, userName: '我', userProfile: '', autoAdvance: false, activeCard: 'first' }
    const f = window.__storyFixture = { prefs, saves: [], calls: [], saveDelay: 0, failSave: false, status: { state: 'stopped', installed: false, environmentState: 'missing', running: false, progress: '', error: '', logs: [], device: { model: 'UI fixture', android: '15', sdk: 35, abi: 'arm64', pageSize: 4096, availableBytes: 1e10 }, version: 'test' } }
    window.androidBridge = {}
    window.Capacitor = {
      PluginHeaders: [{ name: 'HdsRuntime', methods: ['settings', 'cards', 'status', 'saveSettings', 'start', 'stop', 'selectCard', 'rpc', 'cancelInstall','appearance','saveAppearance','pickAppearanceAsset','pickImage','exportStory','restoreStory','resetStory','restorePreviousStory'].map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_, method, options) => {
        f.calls.push(method)
        if (method === 'pickImage') return { cancelled: false, dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=' }
        if (method === 'pickAppearanceAsset') { f.appearance = { ...f.appearance, backgroundData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=' }; return f.appearance }
        if (['exportStory','restoreStory','resetStory','restorePreviousStory'].includes(method)) { f.status.state = 'stopped'; f.status.running = false; return { cancelled: false, backup: 'fixture-backup' } }
        if (method === 'appearance') return f.appearance || { font: 'default', fontSize: 14, backgroundOpacity: 35, panelOpacity: 92, backgroundBlur: 0, theme: 'system' }
        if (method === 'saveAppearance') { f.appearance = structuredClone(options); return {} }
        if (method === 'settings') return structuredClone(f.prefs)
        if (method === 'cards') return { cards: ['first','second'].map((id, i) => ({ id, importedAt: new Date().toISOString(), card: { name: ['赵旻','林间'][i], format: 'v2', description: '生活中的故事', warnings: [] } })) }
        if (method === 'status') return structuredClone(f.status)
        if (method === 'saveSettings') {
          const snapshot = structuredClone(options)
          await new Promise(resolve => setTimeout(resolve, f.saveDelay))
          if (f.failSave) throw new Error('测试：保存失败')
          f.prefs = { ...snapshot, providers: snapshot.providers.filter(row => row.endpoint && row.model).map(({apiKey, clearKey, ...row}) => ({...row, credentialPresent: Boolean(apiKey) || (!clearKey && row.credentialPresent)})) }
          f.saves.push(snapshot); return {}
        }
        if (method === 'start') { f.status.state = f.status.installed ? 'starting' : 'installing'; f.status.running = true; return {} }
        if (method === 'stop') { f.status.state = 'stopped'; f.status.running = false; return {} }
        if (method === 'selectCard') { f.status.state = 'stopped'; f.status.running = false; f.prefs.activeCard = options.id; return {} }
        if (method === 'cancelInstall') { f.status.state = 'stopped'; f.status.running = false; return {} }
        if (method === 'rpc') {
          if (options.method === 'messages.history') return { data: f.messages || [] }
          if (options.method === 'images.upload') return { data: { id: 'fixture-image' } }
          if (options.method === 'images.get') return { data: { dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=' } }
          if (options.method === 'messages.sendLocal') { f.sent = options.payload; f.messages = [{ id: options.payload.requestId, content: options.payload.content, images: options.payload.images, direction: 'user', occurredAt: new Date().toISOString(), status: 'accepted' }]; return { data: { accepted: true } } }
          if (options.method === 'maintenance.start') { f.job = options.payload; return { data: { status: 'running' } } }
          if (options.method === 'maintenance.status') return { data: { status: 'done', result: true } }
          if (options.method === 'memory.factSources') return { data: [{ content: '小林说他喜欢修理收音机。', occurredAt: new Date().toISOString() }] }
          if (options.method === 'story.snapshot') return { data: { story: { status: 'active', state: { alterSystem: { emotionalOffset: { description: '今天的她比往常更放松。' } } } }, entries: [], memories: [], facts: [{ id: 7, scope: 'character', content: '小林喜欢修理收音机。', confidence: 1 }] } }
          return { data: {} }
        }
      }
    }
  })
  await page.goto(process.env.HDS_UI_URL || 'http://127.0.0.1:5173')
  await page.getByRole('button', { name: '点击唤醒', exact: true }).waitFor()
  assert.deepEqual(await page.locator('nav button').allTextContents(), ['故事','见闻','信箱','空间'])
  await page.screenshot({ path: 'artifacts/story-resting.png', fullPage: true })
  await page.getByRole('textbox', { name: '消息内容' }).fill('等你醒来')
  await page.getByRole('button', { name: '点击唤醒', exact: true }).click()
  await page.getByRole('progressbar').waitFor()
  assert.equal(await page.evaluate(() => window.__storyFixture.calls.filter(x => x === 'start').length), 1)
  assert.equal(await page.evaluate(() => window.__storyFixture.calls.includes('install')), false)
  await page.getByRole('button', { name: '见闻', exact: true }).click()
  await page.getByRole('progressbar').waitFor()
  await page.evaluate(() => Object.assign(window.__storyFixture.status, { state: 'healthy', installed: true, environmentState: 'ready' }))
  await page.getByRole('button', { name: '此刻心绪', exact: true }).click()
  await page.getByText('今天的她比往常更放松。').waitFor()
  await page.getByRole('button', { name: '故事', exact: true }).click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '消息内容')
  assert.equal(await page.getByRole('textbox', { name: '消息内容' }).inputValue(), '等你醒来')
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByText('模型与识图', { exact: true }).click()
  await page.getByText('任务分工', { exact: true }).click()
  await page.getByLabel('记忆压缩模型').selectOption('light')
  await page.getByText('已自动保存', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__storyFixture.prefs.providers.find(x => x.id === 'light').useForCompaction), true)
  await page.getByRole('button', { name: '立即重启生效', exact: true }).waitFor()
  await page.getByText('管理模型连接 · 2 条', { exact: true }).click()
  await page.getByRole('button', { name: '＋ 添加连接', exact: true }).click()
  await page.waitForTimeout(900)
  assert.equal(await page.getByLabel('连接名称', { exact: true }).inputValue(), '自定义连接')
  await page.getByRole('button', { name: '删除此连接', exact: true }).click()
  await page.getByText('已自动保存', { exact: true }).waitFor()
  await page.evaluate(() => { window.__storyFixture.saveDelay = 600 })
  await page.getByText('故事与身份', { exact: true }).click()
  const name = page.getByLabel('你的称呼', { exact: true })
  await name.fill('第一笔'); await name.blur()
  await page.waitForTimeout(100)
  await name.fill('第二笔'); await name.blur()
  await page.waitForFunction(() => window.__storyFixture.prefs.userName === '第二笔')
  assert.equal(await name.inputValue(), '第二笔')
  await page.evaluate(() => { window.__storyFixture.failSave = true; window.__storyFixture.saveDelay = 0 })
  await name.fill('保留的草稿'); await name.blur()
  await page.getByText('测试：保存失败').waitFor()
  assert.equal(await name.inputValue(), '保留的草稿')
  await page.evaluate(() => { window.__storyFixture.failSave = false })
  await page.getByRole('button', { name: '重试保存', exact: true }).click()
  await page.waitForFunction(() => window.__storyFixture.prefs.userName === '保留的草稿')
  await page.getByRole('button', { name: '立即重启生效', exact: true }).click()
  await page.waitForFunction(() => window.__storyFixture.calls.includes('stop'))
  const calls = await page.evaluate(() => window.__storyFixture.calls.filter(x => ['stop','start'].includes(x)))
  assert.deepEqual(calls.slice(-2), ['stop','start'])
  await page.evaluate(() => { window.__storyFixture.status.state = 'healthy' })
  await page.waitForFunction(() => !document.querySelector('.restart-banner'))
  await page.getByText('界面与阅读', { exact: true }).click()
  await page.getByText('字体与字号', { exact: true }).click()
  await page.getByLabel('界面字体', { exact: true }).selectOption('serif')
  await page.waitForFunction(() => window.__storyFixture.appearance?.font === 'serif')
  await page.getByLabel('阅读字号 · 14px').fill('18')
  await page.waitForFunction(() => window.__storyFixture.appearance?.fontSize === 18)
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim()), String(18 / 14))
  await page.screenshot({ path: 'artifacts/story-space.png', fullPage: true })
  await page.getByRole('button', { name: '故事', exact: true }).click()
  await page.getByRole('textbox', { name: '消息内容' }).fill('')
  await page.getByRole('button', { name: '添加图片', exact: true }).click()
  await page.getByAltText('待发送图片').waitFor()
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.waitForFunction(() => window.__storyFixture.sent?.images?.length === 1)
  assert.equal(await page.evaluate(() => window.__storyFixture.sent.content), '')
  assert.deepEqual(await page.evaluate(() => window.__storyFixture.sent.images), ['fixture-image'])
  await page.getByRole('button', { name: '查看消息图片', exact: true }).click()
  await page.getByRole('dialog', { name: '消息图片预览' }).waitFor()
  await page.getByRole('button', { name: '关闭图片预览' }).click()
  await page.getByRole('button', { name: '见闻', exact: true }).click()
  await page.getByRole('button', { name: '长期记忆', exact: true }).click()
  await page.getByRole('button', { name: '查看来源', exact: true }).click()
  await page.getByText('小林说他喜欢修理收音机。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '关闭来源' }).click()
  await page.getByRole('button', { name: '补充事实', exact: true }).click()
  await page.getByLabel('事实内容').fill('小林是一位修理师。')
  await page.getByRole('button', { name: '保存事实', exact: true }).click()
  await page.getByText('记忆维护已完成', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__storyFixture.job.kind), 'fact-add')
  await page.getByRole('button', { name: '停用事实', exact: true }).click()
  await page.getByRole('dialog', { name: '停用事实确认' }).waitFor()
  await page.getByRole('button', { name: '确认停用' }).click()
  await page.waitForFunction(() => window.__storyFixture.job.kind === 'fact-forget')
  await page.getByText('记忆维护已完成', { exact: true }).waitFor()
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByText('存档与故事管理', { exact: true }).click()
  await page.getByRole('button', { name: '导出完整存档', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(await page.evaluate(() => window.__storyFixture.calls.includes('exportStory')), false)
  await page.getByRole('button', { name: '导出完整存档', exact: true }).click()
  await page.getByRole('button', { name: '确认继续', exact: true }).click()
  await page.waitForFunction(() => window.__storyFixture.calls.includes('exportStory'))
  await page.evaluate(() => { window.__storyFixture.status.state = 'healthy'; window.__storyFixture.messages = [] })
  await page.getByRole('button', { name: '故事', exact: true }).click()
  await page.getByRole('button', { name: '切换角色或故事', exact: true }).click()
  await page.getByRole('button', { name: '林间 继续故事 →', exact: true }).click()
  await page.waitForFunction(() => window.__storyFixture.prefs.activeCard === 'second')
  assert.equal(await page.getByRole('textbox', { name: '消息内容' }).inputValue(), '')
  for (const width of [320,390,740]) {
    await page.setViewportSize({ width, height: 844 })
    for (const tab of ['故事','见闻','信箱','空间']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${tab} @ ${width}`)
    }
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/story-space-dark.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS: wake/progress/focus, settings accordions, appearance persistence, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.')
} finally { await browser.close() }
