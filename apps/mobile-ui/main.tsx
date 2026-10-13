import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { fromBase64, parseCard, type Card } from '../../packages/card-format'
import type { Message, ModelSettings, NativeBridge, RuntimeStatus, SavedCard } from '../../packages/contracts'
import './style.css'
import { ModelCenter, defaultOptions, newProvider } from './ModelCenter'
import { CardEditor } from './CardEditor'
import { parsePersona, importBytes } from '../../packages/persona-format'

const bridge = registerPlugin<NativeBridge>('HdsRuntime')
type Page = 'chat' | 'cards' | 'story' | 'settings'
const labels: Record<Page, string> = { chat: '对话', cards: '角色', story: '动态', settings: '设置' }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
function Icon({ name }: { name: Page | 'arrow' | 'plus' }) {
  const paths = { chat: 'M5 4h14v12H9l-4 4V4Z', cards: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 20v-2a7 7 0 0 1 14 0v2', story: 'M5 5h14M5 12h10M5 19h14', settings: 'M4 7h16M4 17h16M9 4v6M15 14v6', arrow: 'M5 12h14M13 6l6 6-6 6', plus: 'M12 5v14M5 12h14' }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
function App() {
  const [page, setPage] = useState<Page>('chat')
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [cards, setCards] = useState<SavedCard[]>([])
  const [selected, setSelected] = useState('')
  const [settings, setSettings] = useState<ModelSettings>({ providers: [newProvider()], modelOptions: defaultOptions, userName: '我', userProfile: '', autoAdvance: false })
  const [messages, setMessages] = useState<Message[]>([])
  const [story, setStory] = useState<{ story?: { status: string }; entries: { id: number; content: string; occurredAt: string; kind: string }[]; facts: { id: number; content: string }[]; memories: { id: number; content: string; summary?: string }[]; promptTrace: string[] } | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<{ card: Card; base64: string } | null>(null)
  const [importChoices, setImportChoices] = useState<{ card: Card; base64: string }[]>([])
  const [editingCard, setEditingCard] = useState<SavedCard | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedCard | null>(null)
  const [newName, setNewName] = useState('')
  const [newProfile, setNewProfile] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<'story' | 'memory'>('story')
  const pending = useRef<{ requestId: string; content: string } | null>(null)
  const active = cards.find(card => card.id === selected)
  const native = Capacitor.isNativePlatform()
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null)
  const navigation = useRef<HTMLElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const act = async (task: () => Promise<unknown>, success?: string) => {
    setBusy(true); setNotice('')
    try { await task(); if (success) setNotice(success) } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  const refreshCards = async () => { const data = await bridge.cards(); setCards(data.cards); const prefs = await bridge.settings(); setSelected(prefs.activeCard) }
  useEffect(() => {
    if (!native) { setNotice('浏览器预览模式：原生运行与存储不可用，不显示模拟成功结果。'); return }
    void Promise.all([bridge.settings(), bridge.cards()]).then(([prefs, library]) => { setSettings(prefs); setSelected(prefs.activeCard); setCards(library.cards) }).catch(error => setNotice(errorText(error)))
    let stopped = false, polling = false
    const poll = async () => {
      if (polling || stopped) return
      polling = true
      try {
        const status = await bridge.status()
        if (stopped) return
        setRuntime(status)
        if (status.state === 'healthy') {
          const history = await bridge.rpc({ method: 'messages.history' })
          if (!stopped) setMessages(history.data as Message[])
        }
      } catch (error) { if (!stopped) setNotice(errorText(error)) } finally { polling = false }
    }
    void poll(); const interval = setInterval(() => void poll(), 1000)
    return () => { stopped = true; clearInterval(interval) }
  }, [native])
  useEffect(() => { scroll.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => {
    if (page !== 'story' || runtime?.state !== 'healthy') return
    let cancelled = false
    void bridge.rpc({ method: 'story.snapshot' }).then(result => { if (!cancelled) setStory(result.data as typeof story) }).catch(error => setNotice(errorText(error)))
    return () => { cancelled = true }
  }, [page, runtime?.state])
  useEffect(() => {
    document.documentElement.classList.toggle('native-insets', native)
    const element = navigation.current
    if (!element) return
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--nav-height', `${element.getBoundingClientRect().height}px`))
    observer.observe(element)
    return () => observer.disconnect()
  }, [native])
  const importCard = () => act(async () => {
    const file = await bridge.pickCard()
    const original = fromBase64(file.base64)
    const choices = parsePersona(original).map(card => {
      const bytes = importBytes(card, original)
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
      return { card, base64: btoa(binary) }
    })
    if (choices.length === 1) setPreview(choices[0]); else setImportChoices(choices)
  })
  const savePreview = () => act(async () => {
    if (!preview) return
    const saved = await bridge.saveCard(preview)
    await bridge.selectCard({ id: saved.id })
    setPreview(null); setMessages([]); setStory(null); await refreshCards()
  }, '角色已保存并选中；新故事会在启动 HDS 时创建。')
  const send = async () => {
    if (!draft.trim() || sending) return
    const request = pending.current?.content === draft.trim() ? pending.current : { requestId: crypto.randomUUID(), content: draft.trim() }
    pending.current = request
    setSending(true); setNotice('')
    try { await bridge.rpc({ method: 'messages.sendLocal', payload: request }); setDraft(''); pending.current = null; const result = await bridge.rpc({ method: 'messages.history' }); setMessages(result.data as Message[]) }
    catch (error) { setNotice(`${errorText(error)}；草稿已保留，重试沿用同一个请求编号。`) }
    finally { setSending(false) }
  }
  const runtimeLabel = !native ? '浏览器预览' : runtime?.state === 'healthy' ? 'HDS 运行中' : runtime?.state === 'installing' ? '准备环境中' : runtime?.state === 'starting' ? 'HDS 启动中' : runtime?.state === 'failed' ? '需要检查' : 'HDS 已停止'
  return <div className="app">
    <header><div className="wordmark">HDS<span>INTERLUDE</span></div><button className={`status ${runtime?.state === 'healthy' ? 'online' : ''}`} onClick={() => setPage('settings')}><i />{runtimeLabel}</button></header>
    <main>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {page === 'chat' && <>
        <div className="page-heading"><div><div className="eyebrow">A LIFE IN PROGRESS</div><h1>{active?.card.name || '此刻之外'}<span>，</span></h1><p>{active ? '从一句话开始，让故事慢慢发生。' : '一个角色，一段继续发生的日常。'}</p></div><span className="chapter">01 / 对话</span></div>
        {!messages.length ? <div className="empty-chat"><div className="empty-art"><span /><span /><span /><b>未完待续</b></div><h2>{active ? '故事准备好了' : '先认识一个角色'}</h2><p>{active ? '在设置中准备本机环境、配置模型并启动 HDS。回复和剧情由原版核心生成。' : '导入 JSON 或 PNG 角色卡，也可以亲手写下她的人设。每个角色的故事独立保存。'}</p><button className="primary" onClick={() => setPage(active ? 'settings' : 'cards')}>{active ? '准备开始' : '前往角色库'}<Icon name="arrow" /></button></div> : <div className="messages">{messages.map(message => <article key={message.id} className={`message ${message.direction}`}><div className="message-label">{message.direction === 'user' ? settings.userName : active?.card.name}<time>{new Date(message.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div><div className="bubble">{message.content}</div>{message.status === 'card-opening' && <small>角色卡开场白 · 本地已展示</small>}</article>)}<div ref={scroll} /></div>}
        <form className="composer" onSubmit={event => { event.preventDefault(); void send() }}><textarea rows={1} value={draft} onChange={event => setDraft(event.target.value)} placeholder={runtime?.state === 'healthy' ? '写下你想说的话…' : '启动 HDS 后开始对话'} maxLength={12000} aria-label="消息内容" /><button className="send" disabled={!native || runtime?.state !== 'healthy' || sending || !draft.trim()} aria-label="发送消息"><Icon name="arrow" /></button></form>
      </>}
      {page === 'cards' && <>
        <div className="page-heading"><div><div className="eyebrow">CHARACTER LIBRARY</div><h1>故事里的人<span>。</span></h1><p>人设是起点，经历让她成为自己。</p></div><span className="chapter">02 / 角色</span></div>
        <div className="actions"><button className="primary" disabled={!native || busy} onClick={importCard}><Icon name="plus" />导入角色卡</button><button className="secondary" disabled={!native || busy} onClick={() => setCreateOpen(true)}>手动创建</button></div>
        <p className="caption">JSON / PNG / YAML · 酒馆 V1–V3 · typ0 / HDS koishi.yml<br />CHARX、压缩 PNG 元数据和第三方扩展暂不支持执行。</p>
        <div className="card-list">{cards.map((saved, index) => <article className={`character ${saved.id === selected ? 'chosen' : ''}`} key={saved.id}><div className="character-number">{String(index + 1).padStart(2, '0')}</div><div className="character-body"><div className="character-title"><h2>{saved.card.name}</h2>{saved.id === selected && <span className="tag">当前角色</span>}</div><p>{saved.card.description || saved.card.personality || '尚未填写角色描述'}</p><span className="caption">{saved.card.format.toUpperCase()} · {saved.card.lorebook ? '含世界书' : '独立人设'} · {new Date(saved.importedAt).toLocaleDateString('zh-CN')}</span><div className="card-actions"><button disabled={busy || saved.id === selected} onClick={() => act(async () => { await bridge.selectCard({ id: saved.id }); setMessages([]); setStory(null); await refreshCards() }, '已切换角色，旧故事已保存。请重新启动 HDS。')}>{saved.id === selected ? '正在使用' : '使用这个角色'}</button><button onClick={() => setPreview({ card: saved.card, base64: '' })}>查看人设</button><button disabled={busy} onClick={() => setEditingCard(saved)}>编辑</button><button disabled={busy} className="danger" onClick={() => setDeleteTarget(saved)}>删除</button></div></div></article>)}</div>
        {!cards.length && <div className="quiet-empty">角色库还很安静。<br />为第一段故事选一个主角吧。</div>}
      </>}
      {page === 'story' && <>
        <div className="page-heading"><div><div className="eyebrow">BEYOND THE CONVERSATION</div><h1>生活的切面<span>。</span></h1><p>这里是剧情与记忆；已送达的话在对话页。</p></div><span className="chapter">03 / 动态</span></div>
        <div className="tabs"><button className={detail === 'story' ? 'active' : ''} onClick={() => setDetail('story')}>故事时间线</button><button className={detail === 'memory' ? 'active' : ''} onClick={() => setDetail('memory')}>长期记忆</button><button disabled>QQ 空间 · 待接入</button></div>
        {runtime?.state !== 'healthy' ? <div className="quiet-empty">启动 HDS 后读取当前角色的真实剧情与记忆。</div> : <>
          <div className="inline-actions"><button onClick={() => act(async () => { const result = await bridge.rpc({ method: 'story.snapshot' }); setStory(result.data as typeof story) })}>刷新</button><button onClick={() => act(async () => { await bridge.rpc({ method: story?.story?.status === 'paused' ? 'story.resume' : 'story.pause' }); const result = await bridge.rpc({ method: 'story.snapshot' }); setStory(result.data as typeof story) }, '故事状态已更新。')}>{story?.story?.status === 'paused' ? '恢复故事' : '暂停故事'}</button></div>
          {detail === 'story' ? <div className="timeline">{story?.entries.filter(entry => entry.kind === 'script' || entry.kind === 'setup').map(entry => <article key={entry.id}><time>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</time><p>{entry.content}</p></article>)}{!story?.entries.some(entry => entry.kind === 'script') && <p className="quiet-empty">还没有生成生活剧本。对话后可在这里查看。</p>}</div> : <div className="timeline">{story?.facts.map(fact => <article key={`fact-${fact.id}`}><span className="eyebrow">长期事实 #{fact.id}</span><p>{fact.content}</p></article>)}{story?.memories.map(memory => <article key={`memory-${memory.id}`}><span className="eyebrow">压缩记忆 #{memory.id}</span><p>{memory.summary || memory.content}</p></article>)}{!story?.facts.length && !story?.memories.length && <p className="quiet-empty">经历积累后，记忆会在这里出现。</p>}</div>}
        </>}
        <div className="boundary"><b>QQ 空间尚未验证</b><p>本版未打包 Linux QQ 或 SnowLuma。私聊、群聊、空间读写均不标为可用，后续继续补齐。</p></div>
      </>}
      {page === 'settings' && <>
        <div className="page-heading"><div><div className="eyebrow">YOUR OWN LITTLE WORLD</div><h1>让故事运行<span>。</span></h1><p>HDS 在手机内运行，模型通过你的 API 连接。</p></div><span className="chapter">04 / 设置</span></div>
        <section><div className="section-title"><h2>本机运行环境</h2><span className="tag">ARM64 · 开发预览</span></div><div className="runtime-card"><div className="runtime-symbol">hds<span>本地核心</span></div><div><b>{runtimeLabel}</b><p>{runtime?.progress || 'Ubuntu + Node + Koishi + HDS rc51'}</p>{runtime?.error && <p className="error">{runtime.error}</p>}</div></div><div className="actions"><button className="primary" disabled={!native || busy || ['installing', 'healthy', 'starting', 'stopping'].includes(runtime?.state || '')} onClick={() => act(() => bridge.install())}>{runtime?.environmentState === 'update-required' ? '更新本机环境' : runtime?.installed ? '修复本机环境' : runtime?.state === 'failed' ? '重试准备' : '准备本机环境'}</button><button className="secondary" disabled={!native || busy || !runtime?.installed || !active || ['healthy', 'starting', 'installing', 'stopping'].includes(runtime?.state || '')} onClick={() => act(() => bridge.start())}>启动 HDS</button>{runtime?.state === 'installing' ? <button className="secondary" disabled={busy} onClick={() => act(() => bridge.cancelInstall(), '取消请求已提交，等待当前操作安全结束。')}>取消准备</button> : <button className="secondary" disabled={!native || busy || !runtime?.running} onClick={() => act(() => bridge.stop(), 'HDS 已停止。')}>停止</button>}</div>{runtime?.environmentState === 'update-required' && <p className="caption">APK 包含新版环境，请先更新；角色和剧情独立保留。</p>}{runtime?.cleanupPending && <p className="caption">新版环境已提交，旧环境清理待重试。</p>}<p className="caption">首次安装从 APK 解包；无需 Termux 或电脑。启动前请先选择角色并保存模型。前台通知负责持续运行，系统强停后需手动重启。</p></section>
        <ModelCenter settings={settings} setSettings={setSettings} native={native} busy={busy} bridge={bridge} act={act} notify={setNotice} save={async () => { await bridge.saveSettings(settings); const saved = await bridge.settings(); setSettings(saved); setSelected(saved.activeCard) }} />
        <section><h2>我与这个故事</h2><label>你的称呼<input value={settings.userName} onChange={event => setSettings({ ...settings, userName: event.target.value })} maxLength={128} /></label><label>你的故事人设<textarea rows={3} value={settings.userProfile} onChange={event => setSettings({ ...settings, userProfile: event.target.value })} maxLength={12000} placeholder="你在这个世界中的身份、与角色的关系…" /></label><label className="toggle"><input type="checkbox" checked={settings.autoAdvance} onChange={event => setSettings({ ...settings, autoAdvance: event.target.checked })} /><div><b>持续生活与主动联系</b><p>默认关闭。开启后 HDS 可在通知服务存活时自动调用模型，产生 API 费用。</p></div></label><p className="caption">修改后点击上方“保存全部设置”。已有故事的人设不会被设置刷新覆盖；新角色使用新的初始设置。</p></section>
        <section><h2>设备与诊断</h2><dl><div><dt>设备</dt><dd>{runtime?.device.model || '待原生读取'}</dd></div><div><dt>Android / API</dt><dd>{runtime ? `${runtime.device.android} / ${runtime.device.sdk}` : '—'}</dd></div><div><dt>ABI / 页大小</dt><dd>{runtime ? `${runtime.device.abi} / ${runtime.device.pageSize} B` : '—'}</dd></div><div><dt>可用空间</dt><dd>{runtime ? `${(runtime.device.availableBytes / 1024 ** 3).toFixed(2)} GiB` : '—'}</dd></div><div><dt>应用 / HDS</dt><dd>{runtime?.version || '—'} / rc51</dd></div></dl><div className="actions"><button className="secondary" disabled={!native || busy} onClick={() => act(async () => setDiagnostic(await bridge.diagnostics({ probe: true })))}>查看安装诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(() => bridge.copyDiagnostics(), '安装诊断已复制，不含密钥、人设和聊天。')}>复制诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(async () => { const result = await bridge.saveDiagnostics(); setNotice(result.cancelled ? '已取消保存' : '安装诊断已保存。') })}>保存诊断</button></div>{diagnostic && <pre aria-label="安装诊断">{JSON.stringify(diagnostic, null, 2)}</pre>}<details><summary>查看运行日志</summary><pre>{runtime?.logs.join('\n') || '暂无日志'}</pre></details><p className="caption">请反馈错误阶段、页大小与日志；分享前检查是否包含个人聊天内容。16 KB 页、后台存活与 QQ 能力均需真机验证。</p></section>
      </>}
    </main>
    <nav ref={navigation} aria-label="主导航">{(Object.keys(labels) as Page[]).map(key => <button key={key} className={key === page ? 'active' : ''} onClick={() => setPage(key)} aria-current={key === page ? 'page' : undefined}><Icon name={key} /><span>{labels[key]}</span></button>)}</nav>
    {editingCard && <CardEditor key={editingCard.id} saved={editingCard} busy={busy} close={() => setEditingCard(null)} save={async card => { setBusy(true); try { await bridge.updateCard({ id: editingCard.id, card }); setEditingCard(null); await refreshCards(); setNotice('人设已修改，剧情与记忆保留。重新启动 HDS 后生效。') } finally { setBusy(false) } }} />}
    {deleteTarget && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="删除角色确认"><h2>删除「{deleteTarget.card.name}」？</h2><p>将从角色库移除。已有剧情、记忆与原文件仍保留在本机，重新导入原文件可恢复。当前角色运行时会先停止 HDS。</p><div className="actions"><button className="secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>取消</button><button className="primary" disabled={busy} onClick={() => void act(async () => { const id = deleteTarget.id; await bridge.deleteCard({ id }); setDeleteTarget(null); if (selected === id) { setMessages([]); setStory(null) } await refreshCards() }, '角色已从库中移除，历史保留。')}>确认删除</button></div></section></div>}
    {importChoices.length > 0 && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="选择 HDS 人设"><div className="section-title"><h2>文件包含多个人设</h2><button aria-label="取消导入" onClick={() => setImportChoices([])}>×</button></div><p className="caption">选择要导入的 HDS 实例。</p>{importChoices.map((choice, index) => <button key={index} className="secondary wide" onClick={() => { setPreview(choice); setImportChoices([]) }}>{index + 1}. {choice.card.name}</button>)}</section></div>}
    {preview && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="角色卡预览"><div className="section-title"><span className="eyebrow">CHARACTER / {preview.card.format.toUpperCase()}</span><button aria-label="关闭" onClick={() => setPreview(null)}>×</button></div><h1>{preview.card.name}</h1><p className="preview-text">{preview.card.description}</p>{preview.card.personality && <><h3>性格</h3><p className="preview-text">{preview.card.personality}</p></>}{preview.card.firstMessage && <><h3>开场白</h3><p className="preview-text">{preview.card.firstMessage}</p></>}<h3>兼容说明</h3><ul>{preview.card.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>{preview.base64 && <button className="primary wide" disabled={busy} onClick={savePreview}>保存并使用这个角色<Icon name="arrow" /></button>}</section></div>}
    {createOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="创建角色"><div className="section-title"><h2>写下一个人</h2><button aria-label="关闭" onClick={() => setCreateOpen(false)}>×</button></div><label>角色名称<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={128} /></label><label>角色描述<textarea rows={6} value={newProfile} onChange={event => setNewProfile(event.target.value)} maxLength={262144} placeholder="身份、性格、说话方式与生活背景…" /></label><button className="primary wide" disabled={!newName.trim() || !newProfile.trim()} onClick={() => { const raw = JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: newName.trim(), description: newProfile, personality: '', scenario: '', first_mes: '', mes_example: '', extensions: {} } }); const bytes = new TextEncoder().encode(raw); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); setPreview({ card: parseCard(bytes), base64: btoa(binary) }); setCreateOpen(false); setNewName(''); setNewProfile('') }}>预览角色<Icon name="arrow" /></button></section></div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
