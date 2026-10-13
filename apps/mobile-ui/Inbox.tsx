import React, { useEffect, useRef, useState } from 'react'
import type { NativeBridge, QQStatus, QQConversation, QQMessage, QQPolicy } from '../../packages/contracts'

const phases: Record<string, string> = { stopped: '尚未连接', installing: '准备组件', starting: '启动中', qr: '等待扫码', confirming: '等待确认', connecting: '连接消息通道', online: '在线', offline: '已离线', failed: '需要检查' }
const formatTime = (time: number) => new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
export function Inbox({ bridge, healthy, native, configure }: { bridge: NativeBridge; healthy: boolean; native: boolean; configure: () => void }) {
  const [status, setStatus] = useState<QQStatus | null>(null)
  const [conversations, setConversations] = useState<QQConversation[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<QQMessage[]>([])
  const [draft, setDraft] = useState(''), [peer, setPeer] = useState(''), [kind, setKind] = useState('private')
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [showLogin, setShowLogin] = useState(true)
  const [policyOpen, setPolicyOpen] = useState(false), [groupsOpen, setGroupsOpen] = useState(false)
  const [policy, setPolicy] = useState<QQPolicy>({ enabled: false, users: [], groups: [] })
  const [usersText, setUsersText] = useState(''), [groupsText, setGroupsText] = useState('')
  const [accounts, setAccounts] = useState<{ uin: string; nickName: string; isQuickLogin: boolean }[]>([])
  const [githubProxy, setGithubProxy] = useState('')
  const request = useRef<{ requestId: string; content: string; conversation: string } | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const rpc = async <T,>(method: string, payload?: Record<string, unknown>) => (await bridge.rpc({ method, payload })).data as T
  const act = async (task: () => Promise<unknown>) => { setBusy(true); setNotice(''); try { await task() } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) } }
  useEffect(() => {
    if (!healthy || !native) { setStatus(null); return }
    let cancelled = false, running = false
    const poll = async () => {
      if (cancelled || running) return
      running = true
      try {
        const next = await rpc<QQStatus>('qq.status')
        if (cancelled) return
        setStatus(next)
        const rows = await rpc<QQConversation[]>('qq.conversations')
        if (!cancelled) setConversations(rows)
        if (selected) { const history = await rpc<QQMessage[]>('qq.history', { conversation: selected }); if (!cancelled) setMessages(history) }
      } catch (error) { if (!cancelled) setNotice(error instanceof Error ? error.message : String(error)) } finally { running = false }
    }
    void poll(); const timer = setInterval(() => void poll(), 2000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [healthy, native, selected])
  useEffect(() => { scroll.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])
  const select = (id: string) => { setSelected(id); setMessages([]); setDraft(''); request.current = null }
  const send = () => act(async () => {
    const content = draft.trim()
    if (!request.current || request.current.content !== content || request.current.conversation !== selected) request.current = { requestId: crypto.randomUUID(), content, conversation: selected }
    await rpc('qq.send', request.current); setDraft(''); request.current = null
    setMessages(await rpc('qq.history', { conversation: selected }))
  })
  const editPolicy = () => { const p = status?.policy || policy; setPolicy(p); setUsersText(p.users.join('\n')); setGroupsText(p.groups.join('\n')); setPolicyOpen(true) }
  const renderRows = (rows: QQConversation[]) => rows.map(row => <button className="letter-row" key={row.id} onClick={() => select(row.id)}><span className="letter-avatar">{row.id.startsWith('group:') ? '群' : row.name.slice(0, 1)}</span><span className="letter-content"><span className="letter-title">{row.name}<time>{formatTime(row.time)}</time></span><span className="letter-preview">{row.last || '新会话'}</span></span>{row.unread > 0 && <span className="letter-unread" aria-label={`${row.unread} 条未读`}>{row.unread > 99 ? '99+' : row.unread}</span>}</button>)
  return <section className="inbox-page">
    <div className="page-heading"><div><div className="eyebrow">LETTERS FROM EVERYDAY LIFE</div><h1>信箱<span>。</span></h1><p>把故事，接进真实的日常。</p></div><span className="chapter">02 / QQ</span></div>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭 QQ 提示">×</button></div>}
    {!healthy ? <div className="qq-onboarding"><span className="letter-stamp">待启封</span><h2>先让故事开始运行</h2><p>在设置中准备环境、保存模型并启动 HDS，然后回来下载 QQ 组件、扫码登录。</p><ol><li>准备本机环境与角色</li><li>下载 QQ 组件并扫码</li><li>选择允许角色回复的人</li></ol><button className="primary" onClick={configure}>前往设置 →</button><p className="caption">手机本地运行 · 无需电脑常驻或终端配置</p></div> : <>
      <div className="qq-account"><span className={`qq-indicator ${status?.online ? 'online' : ''}`} /><div><strong>{status?.nickname || 'QQ 本地连接'}{status?.account && <small>{status.account}</small>}</strong><span>{phases[status?.phase || 'stopped'] || '等待状态'} · {status?.policy.enabled ? '白名单自动回复' : '自动回复关闭'}</span></div><button onClick={() => setShowLogin(!showLogin)} aria-expanded={showLogin}>{showLogin ? '收起' : '管理'}</button></div>
      {showLogin && <section className="qq-login">
        <div className="section-title"><h2>{status?.online ? '已经连接' : status?.installed ? '扫码，让角色上线' : '准备 QQ 组件'}</h2><span className="tag">实验接入</span></div>
        <p>{status?.progress || '从腾讯与 NapCat 官方来源下载，完成校验后在手机内运行。下载约 235 MiB，安装时需 1.6 GiB 可用空间。'}</p>
        {status?.error && <p className="qq-error" role="alert">{status.error}</p>}
        {status?.qr && !status.online && <div className="qq-qr"><img src={status.qr} width="256" height="256" alt="QQ 登录二维码，请使用官方 QQ 扫描" /><p>用官方 QQ 扫描并确认登录。<br />同机可尝试保存后从相册识别；不支持时请用另一台设备展示二维码。</p><button className="secondary" disabled={busy} onClick={() => act(async () => { const result = await bridge.saveQQQr({ base64: status.qr.split(',')[1] }); setNotice(result.cancelled ? '已取消保存' : '二维码已保存，请及时扫码；二维码过期后重新获取。') })}>保存二维码</button></div>}
        {status?.phase === 'installing' && <div className="download-progress" role="status">
          <progress aria-label={status.download ? `${status.download.component} 下载进度` : status.progress} max={status.download?.totalBytes || 1} value={status.download?.totalBytes ? Math.min(status.download.receivedBytes, status.download.totalBytes) : undefined} />
          {status.download && <span>{(status.download.receivedBytes / 1048576).toFixed(1)} MiB{status.download.totalBytes ? ` / ${(status.download.totalBytes / 1048576).toFixed(1)} MiB · ${Math.min(100, Math.floor(status.download.receivedBytes / status.download.totalBytes * 100))}%` : ' · 总大小未知'} · {(status.download.bytesPerSecond / 1048576).toFixed(1)} MiB/s</span>}
        </div>}
        {!status?.installed && <details className="download-options"><summary>下载网络设置</summary><label>GitHub 加速地址（可选）<input type="url" value={githubProxy} disabled={busy || status?.phase === 'installing'} onChange={event => setGithubProxy(event.target.value)} placeholder="https://你信任的加速服务/" autoCapitalize="none" spellCheck={false} /></label><p className="caption">默认直连。无法访问 GitHub 时，可填写支持“加速地址/https://github.com/…”的 HTTPS 服务，仅用于 NapCat 下载。QQ 仍从腾讯下载，文件均校验 SHA-256。</p></details>}
        <div className="actions">
          {!status?.installed && <button className="primary" disabled={busy || status?.phase === 'installing'} onClick={() => act(async () => setStatus(await rpc('qq.install', { githubProxy })))}>下载并准备组件</button>}
          {status?.installed && !status.running && <button className="primary" disabled={busy || status.phase === 'installing'} onClick={() => act(async () => setStatus(await rpc('qq.start')))}>启动 QQ · 获取二维码</button>}
          {status?.running && !status.online && <button className="secondary" disabled={busy} onClick={() => act(async () => setStatus(await rpc('qq.refreshQr')))}>刷新二维码</button>}
          {(status?.running || status?.phase === 'installing') && <button className="secondary" disabled={busy} onClick={() => act(async () => setStatus(await rpc('qq.stop')))}>{status.phase === 'installing' ? '取消下载' : '停止 QQ'}</button>}
          {status?.running && !status.online && <button className="secondary" disabled={busy} onClick={() => act(async () => setAccounts(await rpc('qq.accounts')))}>已登录过的账号</button>}
        </div>
        {accounts.filter(account => account.isQuickLogin).map(account => <button className="secondary wide" disabled={busy} key={account.uin} onClick={() => act(() => rpc('qq.quickLogin', { uin: account.uin }))}>登录 {account.nickName || account.uin} · {account.uin}</button>)}
        {!!status?.logs.length && <details><summary>QQ 运行日志</summary><pre>{status.logs.join('\n')}</pre></details>}
        <p className="caption">登录态独立保存在本机，切换角色不清除。停止 HDS 会同时停止 QQ。建议先用测试账号验证，QQ 风控可能要求额外确认。</p>
      </section>}
      <button className="qq-policy-link" onClick={editPolicy}><span><strong>角色自动回复</strong><small>私聊 {status?.policy.users.length || 0} 人 · 群聊 {status?.policy.groups.length || 0} 个 · 群内仅回应 @</small></span><span>设置 →</span></button>
      {!selected ? <>
        <div className="section-title inbox-title"><h2>往来信件</h2><span className="caption">{conversations.length} 个会话</span></div>
        {renderRows(conversations.filter(row => row.id.startsWith('private:')))}
        {!!conversations.some(row => row.id.startsWith('group:')) && <details open={groupsOpen} onToggle={event => setGroupsOpen(event.currentTarget.open)} className="qq-groups"><summary>群聊 · {conversations.filter(row => row.id.startsWith('group:')).length}</summary>{renderRows(conversations.filter(row => row.id.startsWith('group:')))}</details>}
        {!conversations.length && <div className="quiet-empty">还没有收到来信。<br /><span className="caption">连接后收到的消息会显示在这里，最多保留最近 2,000 条。</span></div>}
        <details className="qq-new"><summary>按 QQ 号或群号打开会话</summary><form onSubmit={event => { event.preventDefault(); if (/^[1-9]\d{4,14}$/.test(peer)) select(`${kind}:${peer}`); else setNotice('请输入有效的 QQ 号或群号') }}><label>会话类型<select value={kind} onChange={event => setKind(event.target.value)}><option value="private">私聊</option><option value="group">群聊</option></select></label><label>QQ 号 / 群号<input inputMode="numeric" value={peer} onChange={event => setPeer(event.target.value.replace(/\D/g, ''))} maxLength={15} /></label><button className="secondary">打开会话</button></form></details>
      </> : <section className="letter-thread"><div className="section-title"><button onClick={() => select('')}>← 返回信件</button><h2>{conversations.find(row => row.id === selected)?.name || selected.split(':')[1]}</h2></div><p className="caption">{selected.startsWith('group:') ? '群聊' : '私聊'} · {selected.split(':')[1]} · 以登录的 QQ 账号发送</p><div className="letter-messages">{messages.map(message => <article className={`message ${message.outgoing ? 'user' : 'qq-peer'}`} key={message.id}><div className="message-label">{message.name}<time>{formatTime(message.time)}</time></div><div className="bubble">{message.content}</div></article>)}{!messages.length && <p className="quiet-empty">暂无本机记录</p>}<div ref={scroll} /></div><form className="qq-composer" onSubmit={event => { event.preventDefault(); void send() }}><textarea aria-label="QQ 消息内容" placeholder={status?.online ? '写一封短笺…' : 'QQ 在线后可发送'} value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={2} /><button className="primary" disabled={busy || !status?.online || !draft.trim()}>发送</button></form></section>}
    </>}
    {policyOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="QQ 自动回复设置"><div className="section-title"><h2>允许角色回复谁</h2><button aria-label="关闭" onClick={() => setPolicyOpen(false)}>×</button></div><p>只处理下列账号与群聊。每个角色单独保存这份设置，空白名单不会触发回复。</p><label className="checkbox"><input type="checkbox" checked={policy.enabled} onChange={event => setPolicy({ ...policy, enabled: event.target.checked })} />启用角色自动回复</label><label>私聊 QQ 号 · 每行一个<textarea value={usersText} onChange={event => setUsersText(event.target.value)} rows={4} inputMode="numeric" /></label><label>群号 · 每行一个<textarea value={groupsText} onChange={event => setGroupsText(event.target.value)} rows={3} inputMode="numeric" /></label><p className="caption">群聊沿用 HDS 的 @ 触发、冷却与上下文处理。未列入白名单的消息只显示在信箱，不提交给模型。</p><button className="primary wide" disabled={busy} onClick={() => act(async () => { const split = (text: string) => text.split(/[\s,，;；]+/).filter(Boolean); await rpc('qq.policy', { enabled: policy.enabled, users: split(usersText), groups: split(groupsText) }); setStatus(await rpc('qq.status')); setPolicyOpen(false) })}>保存回复范围</button></section></div>}
  </section>
}
