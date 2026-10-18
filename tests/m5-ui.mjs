import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs')
const directory = mkdtempSync(join(tmpdir(), 'm5-browser-')), cardId = 'a'.repeat(64)
const voiceDir = join(directory, 'voices'); mkdirSync(voiceDir)
const card = { name: '星禾', description: '小林的邻居，经营修理铺。', personality: '开朗温柔', format: 'v2', warnings: [], raw: {} }
const voices = { voices: [{ id: 'builtin', name: '茉莉', type: 'builtin', value: '茉莉' }], characters: {}, defaultVoiceId: 'builtin', dailyLimit: 50000, cooldown: 5, usedTokens: 0, credentialPresent: true }
const sync = () => writeFileSync(join(voiceDir, 'settings.json'), JSON.stringify(voices)); sync()
const wav = Buffer.alloc(44 + 24000)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(24000, 40)
const audio = { audioId: createHash('sha256').update(wav).digest('hex'), duration: .5 }
const audioUri = `data:audio/wav;base64,${wav.toString('base64')}`
const modelRequests = [], synthRequests = [], calls = []
let host, browser, page, failTts = false, recording = false, sampleId = 0, audioDelay = 0
const model = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk
  modelRequests.push(JSON.parse(body))
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾放下修理手册，看见小林的消息，开心地回复：“今天真开心，想把这份好心情告诉你。”', interaction: { seen: true, reply: { mode: 'immediate', content: '今天真开心，想把这份好心情告诉你。' } }, voice: { willingness: .95 } }) } }] }))
})
const settings = { providers: [{ id: 'writer', preset: 'custom', label: '故事模型', endpoint: 'https://example.com/v1', model: 'fixture', protocol: 'chat-completions', enabled: true, credentialPresent: true, useForMain: true, useForCompaction: true, useForAlter: true }], modelOptions: { mainStreamingMode: 'off', mainResponseFormat: 'json-object', mainTemperature: .8, mainMaxTokens: 4096, mainTimeout: 60000, mainPayloadOrder: 'cache-first', failoverEnabled: false, failoverStrategy: 'priority' }, userName: '小林', userProfile: '邻居', autoAdvance: false, activeCard: cardId }
const status = { state: 'healthy', installed: true, environmentState: 'ready', running: true, progress: '', error: '', logs: [], device: { model: 'Playwright + actual HDS', android: '15', sdk: 35, abi: 'arm64', pageSize: 4096, availableBytes: 1e10 }, version: 'M5 fixture' }
const gateway = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.end('{}'); return }
  try {
    let text = ''; for await (const chunk of req) text += chunk
    const body = JSON.parse(text)
    if (req.url === '/synthesize') {
      assert.equal(req.headers.authorization, 'Bearer m5-private-fixture-token')
      synthRequests.push(body)
      if (failTts) { res.statusCode = 503; res.end('{}'); return }
      const binding = voices.characters[cardId]
      if (binding?.enabled && body.willingness >= binding.threshold) { voices.usedTokens += 42; res.end(JSON.stringify(audio)) } else res.end('{}')
      return
    }
    const { method, options = {} } = body; calls.push(method)
    let result = {}
    if (method === 'settings') result = settings
    else if (method === 'cards') result = { cards: [{ id: cardId, card, importedAt: new Date().toISOString() }] }
    else if (method === 'status') result = status
    else if (method === 'appearance') result = { font: 'default', fontSize: 14, backgroundOpacity: 35, panelOpacity: 92, backgroundBlur: 0, theme: 'light' }
    else if (method === 'notificationSettings') result = { enabled: false, permission: 'prompt', available: false }
    else if (method === 'voiceState') result = voices
    else if (method === 'voiceAudio') { assert.equal(options.audioId, audio.audioId); if (audioDelay) await new Promise(resolve => setTimeout(resolve, audioDelay)); result = { dataUri: audioUri } }
    else if (method === 'saveVoiceSettings') {
      for (const field of ['dailyLimit', 'cooldown', 'defaultVoiceId']) if (field in options) voices[field] = options[field]
      if (options.cardId) voices.characters[options.cardId] = options.binding
      sync(); result = voices
    } else if (method === 'saveVoice') {
      const old = voices.voices.find(v => v.id === options.id)
      if (old) old.name = options.name
      else voices.voices.push({ ...options, id: `voice-${++sampleId}` })
      sync(); result = voices
    } else if (method === 'deleteVoice') {
      voices.voices = voices.voices.filter(v => v.id !== options.id)
      if (voices.defaultVoiceId === options.id) voices.defaultVoiceId = 'builtin'
      for (const b of Object.values(voices.characters)) if (b.voiceId === options.id) b.voiceId = ''
      sync(); result = voices
    } else if (method === 'pickVoiceAudio') result = { ...audio, cancelled: false }
    else if (method === 'startVoiceRecording') recording = true
    else if (method === 'stopVoiceRecording') { assert.ok(recording); recording = false; result = audio }
    else if (method === 'cancelVoiceRecording') recording = false
    else if (method === 'previewVoice') { voices.usedTokens += 42; result = audio }
    else if (method === 'rpc') {
      if (options.method === 'qq.conversations') result = { data: [] }
      else if (options.method === 'qq.status') result = { data: { phase: 'stopped', policy: { enabled: false, users: [], groups: [] }, logs: [] } }
      else result = { data: await host.dispatch(options.method, options.payload || {}) }
    }
    res.end(JSON.stringify(result))
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })) }
})
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const closeServer = server => new Promise(resolve => server.close(() => resolve()))
try {
  await listen(model); await listen(gateway)
  settings.providers[0].endpoint = `http://127.0.0.1:${model.address().port}/v1/chat/completions`; settings.providers[0].model = 'm5-browser'
  const reserve = createServer(); await listen(reserve); const port = reserve.address().port; await closeServer(reserve)
  host = await startHost({ card, providers: settings.providers, modelOptions: settings.modelOptions, endpoint: `http://127.0.0.1:${model.address().port}/v1/chat/completions`, model: 'm5-browser', userName: '小林', userProfile: '邻居', autoAdvance: false, token: 'm5-browser-host-token-longer-than-32', port, dataDir: directory,
    voiceBridge: { url: `http://127.0.0.1:${gateway.address().port}/synthesize`, token: 'm5-private-fixture-token', directory: voiceDir, cardId } })
  browser = await chromium.launch({ executablePath: process.env.HDS_BROWSER || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: process.env.HDS_BROWSER_LOW_RESOURCES === '1' ? ['--single-process', '--no-zygote', '--disable-gpu'] : [] })
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(30000)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(({ gatewayUrl, methods }) => {
    window.__audioPlays = 0
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function() { window.__audioPlays++; return originalPlay.call(this) }
    window.androidBridge = {}
    window.Capacitor = { convertFileSrc: value => value, PluginHeaders: [{ name: 'HdsRuntime', methods: methods.map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_, method, options) => { const response = await fetch(gatewayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, options }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data } }
  }, { gatewayUrl: `http://127.0.0.1:${gateway.address().port}/native`, methods: ['settings','cards','status','saveSettings','appearance','notificationSettings','notificationLaunch','rpc','voiceState','saveVoiceSettings','saveVoice','deleteVoice','voiceAudio','previewVoice','pickVoiceAudio','startVoiceRecording','stopVoiceRecording','cancelVoiceRecording'] })
  await page.goto(process.env.HDS_UI_URL || 'http://127.0.0.1:5173')
  await page.getByRole('textbox', { name: '消息内容' }).waitFor()
  console.log('M5 browser: loaded actual App with native bridge fixture.')
  assert.equal(await page.locator('.voice-message').count(), 0)
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByRole('button', { name: /^语音与音色/ }).click()
  const toggle = page.getByRole('checkbox', { name: '允许角色发语音' }); assert.equal(await toggle.isChecked(), false)
  assert.equal(await page.getByRole('combobox', { name: '角色音色', exact: true }).count(), 0)
  await toggle.click()
  await page.getByRole('combobox', { name: '角色音色', exact: true }).waitFor()
  console.log('M5 browser: enabled per-character voice capability.')
  await page.getByRole('button', { name: /音色工作台/ }).click()
  const desk = page.getByRole('dialog', { name: '音色工作台' })
  await desk.getByLabel('音色描述', { exact: true }).fill('温暖清亮的女声，语速舒缓，带一点笑意')
  await desk.getByRole('button', { name: '生成试听', exact: true }).click()
  await desk.getByLabel('音色试听播放器').waitFor()
  await desk.getByLabel('音色名称', { exact: true }).fill('晴天')
  await desk.getByRole('button', { name: '保存音色', exact: true }).click()
  await desk.getByText('晴天', { exact: true }).waitFor()
  await desk.getByLabel('创建方式', { exact: true }).selectOption('reference')
  await desk.getByRole('button', { name: '导入 wav / mp3', exact: true }).click()
  await desk.getByText('参考音频 · 1 秒').waitFor()
  await desk.getByRole('button', { name: '开始录音', exact: true }).click()
  await desk.getByRole('button', { name: '结束录音', exact: true }).click()
  await desk.getByLabel('音色名称', { exact: true }).fill('我的录音')
  await desk.getByRole('button', { name: '保存音色', exact: true }).click()
  await desk.getByText('我的录音', { exact: true }).waitFor()
  const row = desk.locator('article').filter({ has: page.getByText('我的录音', { exact: true }) })
  await row.getByRole('button', { name: '改名', exact: true }).click()
  await row.getByRole('textbox', { name: '新音色名称' }).fill('晚风')
  await row.getByRole('button', { name: '保存新名称' }).click()
  await desk.getByText('晚风', { exact: true }).waitFor()
  console.log('M5 browser: workbench create, import, record and rename complete.')
  mkdirSync('artifacts/m5', { recursive: true })
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 }); await desk.evaluate(element => { element.scrollTop = 0 }); await desk.screenshot({ path: `artifacts/m5/workbench-${width}.png` })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await desk.locator('.voice-library').scrollIntoViewIfNeeded(); await desk.screenshot({ path: 'artifacts/m5/workbench-library-390.png' })
  await desk.getByRole('button', { name: '关闭音色工作台' }).click()
  await page.getByRole('combobox', { name: '角色音色', exact: true }).selectOption({ label: '晚风' })
  await page.getByRole('button', { name: '故事', exact: true }).click()
  const composer = page.getByRole('textbox', { name: '消息内容' })
  await composer.fill('今天心情怎么样？'); await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.getByRole('button', { name: '播放语音', exact: true }).waitFor()
  assert.equal(await page.locator('article.message.character-reply').count(), 1)
  assert.equal(await page.locator('.voice-transcript').count(), 0)
  assert.equal(synthRequests[0].text, '今天真开心，想把这份好心情告诉你。')
  assert.match(modelRequests[0].messages[0].content, /CURRENT LOCAL VOICE OPTION/)
  audioDelay = 1200
  await page.getByRole('button', { name: '播放语音', exact: true }).click()
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.waitForTimeout(1500)
  assert.equal(await page.evaluate(() => window.__audioPlays), 0, 'leaving chat cancels pending audio playback')
  audioDelay = 0
  await page.getByRole('button', { name: '故事', exact: true }).click()
  await page.getByRole('button', { name: '播放语音', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.voice-play')?.getAttribute('aria-label') === '暂停语音')
  await page.getByRole('button', { name: '展开文字稿' }).click()
  await page.locator('.voice-transcript').getByText('今天真开心，想把这份好心情告诉你。').waitFor()
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 }); await page.screenshot({ path: `artifacts/m5/voice-chat-${width}.png`, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  failTts = true
  await composer.fill('再说一遍吧'); await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('article.message.character-reply').length === 2)
  assert.equal(await page.locator('.voice-message').count(), 1)
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByRole('button', { name: /^语音与音色/ }).click()
  await toggle.click()
  await page.waitForFunction(() => {
    const toggle = document.querySelector('.voice-settings input[type="checkbox"]')
    return toggle && !toggle.checked && !toggle.disabled
  })
  assert.equal(voices.characters[cardId].enabled, false, 'Wait for the saved binding before starting another model turn')
  await page.getByRole('button', { name: '故事', exact: true }).click()
  assert.equal(await page.locator('.voice-message').count(), 1, 'Disabling future voice preserves existing audio history')
  await composer.fill('普通聊天继续'); await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('article.message.character-reply').length === 3)
  assert.doesNotMatch(modelRequests.at(-1).messages[0].content, /CURRENT LOCAL VOICE OPTION/)
  assert.equal(await page.locator('.voice-message').count(), 1, 'Disabling future voice preserves existing audio history')
  await page.screenshot({ path: 'artifacts/m5/voice-disabled.png', fullPage: true })
  await page.getByRole('button', { name: '空间', exact: true }).click()
  await page.getByRole('button', { name: /^语音与音色/ }).click()
  await page.getByRole('button', { name: /音色工作台/ }).click()
  const deleteRow = desk.locator('article').filter({ has: page.getByText('晚风', { exact: true }) })
  await deleteRow.getByRole('button', { name: '删除', exact: true }).click()
  await deleteRow.getByRole('button', { name: '确认删除音色', exact: true }).click()
  await desk.getByText('晚风', { exact: true }).waitFor({ state: 'detached' })
  assert.equal(voices.characters[cardId].voiceId, '')
  assert.ok(calls.includes('startVoiceRecording') && calls.includes('stopVoiceRecording') && calls.includes('pickVoiceAudio'))
  assert.ok(voices.usedTokens >= 84); assert.deepEqual(errors, [])
  console.log('PASS M5: actual HDS decisions → LocalBot → SQLite → browser voice bubble, real WAV playback, transcript in one message, failed TTS preserves text, live disabled gate preserves historical audio and removes future voice instruction; workbench design/import/record/preview/save/rename/bind/delete; 320/390/740 px screenshots. Android microphone/SAF/TTS are fixtures; native implementation is separately covered by Robolectric.')
} catch (error) {
  if (page) { await page.screenshot({ path: 'artifacts/m5/ui-failure.png', fullPage: true }).catch(() => {}); console.error((await page.locator('body').innerText()).slice(-4000)) }
  throw error
} finally {
  if (browser) await browser.close()
  if (host) await host.stop()
  await closeServer(model); await closeServer(gateway); rmSync(directory, { recursive: true, force: true })
}
