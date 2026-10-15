import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { WebSocketServer, type WebSocket } from 'ws'
import { parseJsonCard } from '../packages/card-format'
const { startHost } = createRequire(import.meta.url)('../runtime/generated/host.cjs') as typeof import('../runtime/host')
const { qqPolicy, plainMessage } = createRequire(import.meta.url)('../runtime/generated/qq.cjs') as typeof import('../runtime/qq')
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (check: () => boolean | Promise<boolean>) => { const deadline = Date.now() + 20000; while (!await check()) { if (Date.now() > deadline) throw new Error('Fixture timeout'); await delay(100) } }

test('QQ policy fails closed and renders message elements as inert text', () => {
  assert.throws(() => qqPolicy({ enabled: true, users: ['https://example.com'], groups: [] }))
  assert.throws(() => qqPolicy({ enabled: 'false', users: [], groups: [] }))
  assert.deepEqual(qqPolicy({ enabled: true, users: ['12345', '12345'], groups: [] }), { enabled: true, users: ['12345'], groups: [] })
  assert.equal(plainMessage('你好<image src="file:///private"/><at id="12345"/>'), '你好[图片]@12345 ')
})

test('real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once', { timeout: 90000 }, async () => {
  const calls: any[] = [], delivered: any[] = []
  let loggedIn = false, loginActions = 0
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/auth/login') { assert.equal(JSON.parse(raw).hash, createHash('sha256').update('fixture-secret.napcat').digest('hex')); res.end(JSON.stringify({ code: 0, data: { Credential: 'fixture-credential' } })); return }
    if (req.url === '/api/QQLogin/CheckLoginStatus') { assert.equal(req.headers.authorization, 'Bearer fixture-credential'); res.end(JSON.stringify({ code: 0, data: { isLogin: loggedIn, coreReady: loggedIn } })); return }
    if (req.url === '/api/QQLogin/GetQQLoginInfo') { res.end(JSON.stringify({ code: 0, data: { uin: '55555', nick: '星禾' } })); return }
    if (req.url === '/api/QQLogin/RefreshQRcode' || req.url === '/api/QQLogin/SetQuickLogin') { loginActions++; res.end(JSON.stringify({ code: -1, message: 'QQ Is Logined' })); return }
    const modelRequest = JSON.parse(raw)
    calls.push(modelRequest)
    const prompt = modelRequest.messages.map((message: any) => typeof message.content === 'string' ? message.content : '').join('\n')
    const refs = [...prompt.matchAll(/"messageRef"\s*:\s*"(msg-[^"]+)"/g)]
    const replyTo = refs.at(-1)?.[1]
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: '星禾放下书，拿起手机回复邻居。', ...(replyTo ? { groupReply: { mode: 'immediate', content: 'QQ_QUOTE_REPLY', replyTo } } : {}), interaction: { seen: true, reply: { mode: 'immediate', content: 'QQ_FIXTURE_REPLY，明天见。' } } }) } }] }))
  })
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve)); const httpPort = (http.address() as any).port
  const ws = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await new Promise<void>(resolve => ws.once('listening', resolve))
  let socket!: WebSocket
  ws.on('connection', (client, request) => {
    assert.equal(request.headers.authorization, 'Bearer fixture-ws-token'); socket = client
    client.on('message', buffer => {
      const request = JSON.parse(buffer.toString()); let data: any = {}
      if (request.action === 'get_login_info') data = { user_id: 55555, nickname: '星禾' }
      if (request.action === 'get_guild_service_profile') data = { tiny_id: '0' }
      if (request.action === 'get_stranger_info') data = { user_id: request.params.user_id, nickname: '邻居' }
      if (request.action === 'get_group_info') data = { group_id: request.params.group_id, group_name: '朋友群' }
      if (request.action === 'send_private_msg' || request.action === 'send_group_msg') { delivered.push(request); data = { message_id: 70000 + delivered.length } }
      client.send(JSON.stringify({ status: 'ok', retcode: 0, data, echo: request.echo }))
    })
  })
  const reserved = createServer(); await new Promise<void>(resolve => reserved.listen(0, '127.0.0.1', resolve)); const port = (reserved.address() as any).port; await new Promise<void>(resolve => reserved.close(() => resolve()))
  const dir = mkdtempSync(join(tmpdir(), 'hds-qq-test-'))
  const host = await startHost({ card: parseJsonCard(JSON.stringify({ spec: 'chara_card_v2', data: { name: '星禾', description: 'QQ_PERSONA_MARKER，邻居的朋友' } })), endpoint: `http://127.0.0.1:${httpPort}/v1/chat/completions`, model: 'fixture', userName: '邻居', userProfile: '', autoAdvance: false, mobileConfig: { sections: { chatActions: { enabled: true, quoteReply: true } } }, token: 'qq-test-rpc-token-more-than-32-characters', port, dataDir: dir, qqDir: join(dir, 'qq') })
  try {
    const qq = host.qq! as any
    assert.equal((await host.dispatch('qq.status', {}) as any).policy.enabled, false)
    // Exercise the actual NapCat HTTP auth client and actual OneBot WebSocket adapter;
    // only external QQ endpoints are replaced by loopback fixtures.
    Object.assign(qq, { webPort: httpPort, webToken: 'fixture-secret' })
    assert.equal((await qq.api('QQLogin/CheckLoginStatus')).isLogin, false)
    // Only the external QQ process/API are fixtures. The compiled production
    // login poll must load its own adapter, bind the story and open OneBot.
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })
    Object.assign(qq, { child, phase: 'confirming', wsPort: (ws.address() as any).port, wsToken: 'fixture-ws-token' })
    loggedIn = true
    const bindStory = qq.bindStory
    qq.bindStory = async () => { throw new Error('fixture channel initialization failure') }
    await qq.poll()
    assert.equal(qq.status().loggedIn, true, 'Channel failure must not erase confirmed QQ login')
    assert.equal(qq.status().online, false)
    assert.match(qq.status().error, /消息通道初始化失败/)
    assert.match(qq.status().progress, /QQ 已登录/)
    qq.bindStory = bindStory
    await qq.poll()
    assert.equal(qq.status().error, '', 'Production post-login adapter loading must succeed')
    await waitFor(() => qq.status().online)
    await qq.poll()
    assert.equal(qq.status().phase, 'online')
    assert.equal(qq.status().loggedIn, true)
    await host.dispatch('qq.refreshQr', {})
    const quick = await host.dispatch('qq.quickLogin', { uin: '55555' }) as any
    assert.equal(quick.alreadyLoggedIn, true)
    assert.equal(loginActions, 0, 'Already logged-in accounts must not receive new QR/login requests')
    const incoming = (id: number, user: number, text: string) => socket.send(JSON.stringify({ post_type: 'message', message_type: 'private', sub_type: 'friend', self_id: 55555, user_id: user, message_id: id, time: Math.floor(Date.now() / 1000), message: [{ type: 'text', data: { text } }], raw_message: text, font: 0, sender: { user_id: user, nickname: '邻居' } }))
    incoming(1001, 12345, '尚未授权的消息')
    await waitFor(async () => (await host.dispatch('qq.conversations', {}) as any[]).length > 0)
    await delay(1400); assert.equal(calls.length, 0, 'Disabled auto-reply must not call a model')
    await host.dispatch('qq.policy', { enabled: true, users: ['12345'], groups: [] })
    incoming(1002, 99999, '不在白名单')
    await delay(1400); assert.equal(calls.length, 0)
    incoming(1003, 12345, '明天见面好吗？')
    incoming(1003, 12345, '明天见面好吗？')
    await waitFor(() => delivered.length > 0)
    assert.match(JSON.stringify(calls), /QQ_PERSONA_MARKER/)
    assert.equal(String(delivered[0].params.user_id), '12345')
    const history = await host.dispatch('qq.history', { conversation: 'private:12345' }) as any[]
    assert.equal(history.filter(row => row.id.endsWith(':1003')).length, 1)
    assert.ok(history.some(row => row.outgoing), 'Real HDS delivery must appear in QQ inbox')
    const stories = await host.app.database.get('interlude_story', {})
    assert.equal(stories.length, 1, 'QQ and local conversation must share the current persona story')
    const before = delivered.length, manual = { conversation: 'private:12345', content: '[CQ:at,qq=all] 原样文本', requestId: 'manual-message-001' }
    await host.dispatch('qq.send', manual); await host.dispatch('qq.send', manual)
    assert.equal(delivered.length, before + 1)
    assert.deepEqual(delivered.at(-1).params.message, [{ type: 'text', data: { text: manual.content } }])
    const count = calls.length
    await host.dispatch('qq.policy', { enabled: true, users: ['12345'], groups: ['88888'] })
    const group = (id: number, mention: boolean) => socket.send(JSON.stringify({ post_type: 'message', message_type: 'group', sub_type: 'normal', self_id: 55555, user_id: 77777, group_id: 88888, message_id: id, time: Math.floor(Date.now() / 1000), message: [...(mention ? [{ type: 'at', data: { qq: '55555' } }] : []), { type: 'text', data: { text: 'GROUP_FIXTURE，今天好吗？' } }], sender: { user_id: 77777, nickname: '群友', role: 'member' } }))
    group(1004, false); await delay(1500); assert.equal(calls.length, count, 'Ordinary group messages must not trigger a model')
    group(1005, true); await waitFor(() => calls.length > count)
    assert.match(JSON.stringify(calls.at(-1)), /GROUP_FIXTURE/)
    await waitFor(async () => (await host.dispatch('qq.conversations', {}) as any[]).some(row => row.id === 'group:88888'))
    await waitFor(() => delivered.some(row => row.action === 'send_group_msg' && String(row.params.group_id) === '88888'))
    const groupDelivery = delivered.find(row => row.action === 'send_group_msg')
    assert.ok(groupDelivery.params.message.some((segment: any) => segment.type === 'reply' && String(segment.data.id) === '1005'), 'HDS quote must reach the actual OneBot send payload')
    await host.dispatch('qq.policy', { enabled: false, users: ['12345'], groups: [] })
    const bot = host.app.bots.find(bot => bot.platform === 'onebot')!
    await assert.rejects(() => bot.sendMessage('private:12345', 'must not send'), /暂停|授权/)
    await host.dispatch('qq.stop', {})
    assert.equal((await host.dispatch('qq.status', {}) as any).online, false)
    assert.ok((await host.dispatch('qq.conversations', {}) as any[]).length >= 2)
  } finally {
    await host.stop(); for (const client of ws.clients) client.terminate(); await new Promise<void>(resolve => ws.close(() => resolve())); await new Promise<void>(resolve => http.close(() => resolve()))
  }
})
