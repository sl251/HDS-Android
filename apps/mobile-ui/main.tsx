import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { fromBase64, parseCard, type Card } from '../../packages/card-format'
import type { Message, ModelSettings, NativeBridge, RuntimeStatus, SavedCard } from '../../packages/contracts'
import { messageImages } from '../../packages/contracts'
import './style.css'
import { ModelCenter, defaultOptions, newProvider } from './ModelCenter'
import { CardEditor } from './CardEditor'
import { Inbox } from './Inbox'
import { parsePersona, importBytes } from '../../packages/persona-format'
import { AppearanceSettings, useAppearance } from './AppearanceSettings'
import { StoredImage } from './StoredImage'
import { MemoryTools, type Fact } from './MemoryTools'
import { StoryManagement } from './StoryManagement'
import { BackgroundImage } from './BackgroundImage'

const bridge = registerPlugin<NativeBridge>('HdsRuntime')
type Page = 'chat' | 'inbox' | 'cards' | 'story' | 'settings'
const labels: Record<Page, string> = { chat: '故事', inbox: '信箱', cards: '角色', story: '见闻', settings: '空间' }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
function Icon({ name }: { name: Page | 'arrow' | 'plus' }) {
  const paths = { inbox: 'M3 5h18v14H3V5Zm0 0 9 8 9-8', chat: 'M5 4h14v12H9l-4 4V4Z', cards: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 20v-2a7 7 0 0 1 14 0v2', story: 'M5 5h14M5 12h10M5 19h14', settings: 'M4 7h16M4 17h16M9 4v6M15 14v6', arrow: 'M5 12h14M13 6l6 6-6 6', plus: 'M12 5v14M5 12h14' }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
function App() {
  const [page, setPage] = useState<Page>('chat')
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [cards, setCards] = useState<SavedCard[]>([])
  const [selected, setSelected] = useState('')
  const [settings, setSettings] = useState<ModelSettings>({ providers: [newProvider()], modelOptions: defaultOptions, userName: '我', userProfile: '', autoAdvance: false })
  const [messages, setMessages] = useState<Message[]>([])
  const [story, setStory] = useState<{ story?: { status: string; state?: { alterSystem?: { emotionalOffset?: { description: string; direction: string } | null } } }; entries: { id: number; content: string; occurredAt: string; kind: string }[]; facts: Fact[]; memories: { id: number; content: string; summary?: string }[]; intents?: { id: number; summary: string; notBefore?: string }[]; overlay?: { state: Record<string, unknown> }; promptTrace: string[] } | null>(null)
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<{ id: string; dataUri: string }[]>([])
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
  const [detail, setDetail] = useState<'story' | 'memory' | 'mind'>('story')
  const [switcher, setSwitcher] = useState(false)
  const [saveState, setSaveState] = useState('设置自动保存')
  const [saveError, setSaveError] = useState('')
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const composer = useRef<HTMLTextAreaElement>(null)
  const focusAfterWake = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const savedSettings = useRef('')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const runtimeRef = useRef(runtime)
  runtimeRef.current = runtime
  const profileRevision = useRef(0)
  const pending = useRef<{ requestId: string; content: string; images?: string[] } | null>(null)
  const active = cards.find(card => card.id === selected)
  const native = Capacitor.isNativePlatform()
  const appearance = useAppearance(bridge, native, setNotice)
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null)
  const navigation = useRef<HTMLElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const act = async (task: () => Promise<unknown>, success?: string) => {
    setBusy(true); setNotice('')
    try { await task(); if (success) setNotice(success) } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  const refreshCards = async () => { const data = await bridge.cards(); setCards(data.cards); const prefs = await bridge.settings(); setSelected(prefs.activeCard) }
  const storyChanged = async () => {
    profileRevision.current++; pending.current = null; setDraft(''); setAttachments([]); setMessages([]); setStory(null)
    await refreshCards(); setRuntime(await bridge.status()); setRestartNeeded(false)
  }
  const refreshStory = async () => { const revision = profileRevision.current; const result = await bridge.rpc({ method: 'story.snapshot' }); if (revision === profileRevision.current) setStory(result.data as typeof story) }
  useEffect(() => {
    if (!native) { setNotice('浏览器预览模式：原生运行与存储不可用，不显示模拟成功结果。'); return }
    void Promise.all([bridge.settings(), bridge.cards()]).then(([prefs, library]) => { savedSettings.current = JSON.stringify(prefs); setSettings(prefs); setSettingsReady(true); setSelected(prefs.activeCard); setCards(library.cards) }).catch(error => setNotice(errorText(error)))
    let stopped = false, polling = false
    const poll = async () => {
      if (polling || stopped) return
      polling = true
      try {
        const status = await bridge.status()
        if (stopped) return
        setRuntime(status)
        if (status.state === 'healthy') {
          const revision = profileRevision.current
          const history = await bridge.rpc({ method: 'messages.history' })
          if (!stopped && revision === profileRevision.current) setMessages(history.data as Message[])
        }
      } catch (error) { if (!stopped) setNotice(errorText(error)) } finally { polling = false }
    }
    void poll(); const interval = setInterval(() => void poll(), 1000)
    return () => { stopped = true; clearInterval(interval) }
  }, [native])
  useEffect(() => { scroll.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => {
    if (page !== 'story' || runtime?.state !== 'healthy') return
    let cancelled = false, loading = false
    const refresh = async () => {
      if (loading) return
      loading = true
      try { const revision = profileRevision.current; const result = await bridge.rpc({ method: 'story.snapshot' }); if (!cancelled && revision === profileRevision.current) setStory(result.data as typeof story) }
      catch (error) { if (!cancelled) setNotice(errorText(error)) }
      finally { loading = false }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [page, runtime?.state, selected])
  const persistSettings = () => {
    const next = saveQueue.current.catch(() => {}).then(async () => {
      if (!native || !settingsReady) return
      const snapshot = settingsRef.current
      const fingerprint = JSON.stringify(snapshot)
      if (fingerprint === savedSettings.current) return
      setSaveState('正在保存…'); setSaveError('')
      try {
        await bridge.saveSettings(snapshot)
        const saved = await bridge.settings()
        savedSettings.current = fingerprint
        // Do not overwrite edits made while native encrypted storage was writing.
        if (settingsRef.current === snapshot) {
          const merged = { ...saved, providers: snapshot.providers.map(row => saved.providers.find(item => item.id === row.id) ?? row) }
          savedSettings.current = JSON.stringify(merged)
          settingsRef.current = merged; setSettings(merged)
        }
        setSaveState('已自动保存')
        if (runtimeRef.current?.running) setRestartNeeded(true)
      } catch (error) { setSaveState('尚未保存'); setSaveError(errorText(error)); throw error }
    })
    saveQueue.current = next
    return next
  }
  useEffect(() => {
    if (!native || !settingsReady || JSON.stringify(settings) === savedSettings.current) return
    setSaveState('等待保存')
    const timer = setTimeout(() => {
      const element = document.activeElement
      if (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && element.type !== 'checkbox')) return
      void persistSettings().catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [settings, native, settingsReady])
  useEffect(() => {
    if (runtime?.state === 'healthy' && focusAfterWake.current) {
      setRestartNeeded(false)
      if (page === 'chat') { composer.current?.focus(); focusAfterWake.current = false }
    }
    if (runtime?.state === 'failed') focusAfterWake.current = false
  }, [runtime?.state, page])
  const wake = () => act(async () => {
    if (!active) { setSwitcher(true); return }
    if (!settingsRef.current.providers.some(row => row.enabled && row.useForMain && row.endpoint && row.model)) { setPage('settings'); setNotice('为故事选择一个模型，就可以开始了。'); return }
    await persistSettings()
    focusAfterWake.current = true
    try { await bridge.start(); setRuntime(await bridge.status()) }
    catch (error) { focusAfterWake.current = false; throw error }
  })
  const restart = () => act(async () => {
    await persistSettings()
    await bridge.stop(); setRuntime(await bridge.status())
    focusAfterWake.current = true
    await bridge.start(); setRuntime(await bridge.status())
  })
  const switchCard = (id: string) => act(async () => {
    if (id === selected) { setSwitcher(false); return }
    const resume = runtimeRef.current?.state === 'healthy'
    profileRevision.current++
    await bridge.selectCard({ id })
    profileRevision.current++
    pending.current = null; setDraft(''); setAttachments([]); setMessages([]); setStory(null)
    await refreshCards(); setRuntime(await bridge.status()); setSwitcher(false)
    if (resume) { await persistSettings(); focusAfterWake.current = true; await bridge.start(); setRuntime(await bridge.status()) }
  })
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
    setPreview(null); await storyChanged()
  }, '角色已加入你的空间，随时可以开始故事。')
  const send = async () => {
    if ((!draft.trim() && !attachments.length) || sending || busy || runtime?.state !== 'healthy') return
    const imageIds = attachments.map(image => image.id)
    const request = pending.current?.content === draft.trim() && JSON.stringify(pending.current.images || []) === JSON.stringify(imageIds) ? pending.current : { requestId: crypto.randomUUID(), content: draft.trim(), images: imageIds }
    pending.current = request
    setSending(true); setNotice('')
    try { await bridge.rpc({ method: 'messages.sendLocal', payload: request }); setDraft(''); setAttachments([]); pending.current = null; const result = await bridge.rpc({ method: 'messages.history' }); setMessages(result.data as Message[]) }
    catch (error) { setNotice(`${errorText(error)}；草稿已保留，可以重试。`) }
    finally { setSending(false) }
  }
  const pickImage = () => act(async () => {
    if (!settingsRef.current.modelOptions.visionEnabled) { setPage('settings'); setNotice('请展开模型与识图，开启图片理解并选择支持图片的模型。'); return }
    if (restartNeeded) { setNotice('识图设置已保存，请先点击立即重启生效。'); return }
    const revision = profileRevision.current
    const image = await bridge.pickImage()
    if (image.cancelled || !image.dataUri || revision !== profileRevision.current) return
    const result = await bridge.rpc({ method: 'images.upload', payload: { dataUri: image.dataUri } })
    if (revision === profileRevision.current) setAttachments(current => current.some(item => item.id === (result.data as { id: string }).id) ? current : [...current, { id: (result.data as { id: string }).id, dataUri: image.dataUri! }].slice(0, 3))
  })
  const transitioning = ['installing', 'starting', 'stopping'].includes(runtime?.state || '')
  const healthy = runtime?.state === 'healthy'
  const modelReady = settings.providers.some(row => row.enabled && row.useForMain && row.endpoint && row.model)
  const runtimeLabel = !native ? '界面预览' : healthy ? '随时在线 · 故事继续' : runtime?.state === 'installing' ? '正在准备核心组件' : runtime?.state === 'starting' ? '正在醒来…' : runtime?.state === 'stopping' ? '正在保存故事…' : runtime?.state === 'failed' ? '唤醒未完成 · 可重试' : '正在休息中'
  const wakePanel = <div className={`wake-panel ${transitioning ? 'waking' : ''}`} role="status"><div><b>{active?.card.name || '故事'} · {runtimeLabel}</b><p>{runtime?.state === 'installing' ? '首次准备约 1 分钟，请稍候…' : runtime?.state === 'starting' ? '正在翻开属于你们的这一页。' : '之前的经历留在这里，下一句话由你开始。'}</p></div>{transitioning ? <progress aria-label={runtimeLabel} /> : <button className="primary wake-button" disabled={!native || busy || !settingsReady} onClick={wake}>{!active ? '选择主角' : !modelReady ? '连接故事模型' : runtime?.state === 'failed' ? '再次唤醒' : '点击唤醒'}<Icon name="arrow" /></button>}{runtime?.state === 'installing' && <button className="text-button" onClick={() => act(() => bridge.cancelInstall())}>取消准备</button>}{runtime?.error && <p className="error">{runtime.error}</p>}</div>
  return <>
    {appearance.value.backgroundData && <BackgroundImage source={appearance.value.backgroundData} opacity={appearance.value.backgroundOpacity} blur={appearance.value.backgroundBlur} failed={() => setNotice('背景图片无法显示，请在界面设置中重新选择图片。')} />}
    <div className="app">
    <header><div className="wordmark">HDS<span>INTERLUDE</span></div><button className={`status ${runtime?.state === 'healthy' ? 'online' : ''}`} disabled={busy || transitioning || (native && !settingsReady)} onClick={() => healthy ? setPage('chat') : native ? void wake() : setPage('settings')}><i />{runtimeLabel}</button></header>
    <main onBlurCapture={() => { void persistSettings().catch(() => {}) }}>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {restartNeeded && <div className="restart-banner" role="status"><div><b>新配置已就绪</b><span>重启后生效，剧情与记忆会保留。</span></div><button disabled={busy || sending || transitioning} onClick={restart}>立即重启生效</button></div>}
      {page === 'inbox' && <Inbox bridge={bridge} healthy={runtime?.state === 'healthy'} native={native} configure={() => setPage('settings')} />}
      {page === 'chat' && <>
        <div className="page-heading"><div><div className="eyebrow">A LIFE IN PROGRESS</div><h1><button className="character-switch" aria-label="切换角色或故事" onClick={() => setSwitcher(true)}>{active?.card.name || '此刻之外'}<span aria-hidden="true">⌄</span></button></h1><p>{active ? '从一句话开始，让故事慢慢发生。' : '一个角色，一段继续发生的日常。'}</p></div><span className="chapter">01 / 故事</span></div>
        {!messages.length ? <div className="empty-chat"><div className="empty-art"><span /><span /><span /><b>未完待续</b></div><h2>{active ? healthy ? '故事正在继续' : '等你轻轻唤醒' : '先认识一个角色'}</h2><p>{active ? '那些一起经历的日常，都值得被记住。' : '导入一张角色卡，或亲手写下一个人。让日常从这里开始。'}</p>{!active && <button className="primary" onClick={() => setSwitcher(true)}>选择故事的主角<Icon name="arrow" /></button>}</div> : <div className="messages">{messages.map(message => <article key={message.id} className={`message ${message.direction}`}><div className="message-label">{message.direction === 'user' ? settings.userName : active?.card.name}<time>{new Date(message.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div><div className="bubble">{message.content}{messageImages(message.images).map(id => <StoredImage key={id} id={id} bridge={bridge} />)}</div>{message.status === 'card-opening' && <small>角色卡开场白 · 本地已展示</small>}</article>)}<div ref={scroll} /></div>}
        {active && !healthy && wakePanel}
        <div className="composer-wrap">{attachments.length > 0 && <div className="attachment-tray">{attachments.map(image => <div key={image.id}><img src={image.dataUri} alt="待发送图片" /><button aria-label="移除图片" disabled={sending || busy} onClick={() => setAttachments(current => current.filter(item => item.id !== image.id))}>×</button></div>)}</div>}<form className="composer" onSubmit={event => { event.preventDefault(); void send() }}><button type="button" className="attach-button" aria-label="添加图片" disabled={!native || !healthy || busy || sending || attachments.length >= 3} onClick={pickImage}>＋</button><textarea ref={composer} disabled={sending} rows={1} value={draft} onChange={event => setDraft(event.target.value)} placeholder={runtime?.state === 'healthy' ? '写下你想说的话…' : '先写下来，唤醒后就能发送…'} maxLength={12000} aria-label="消息内容" /><button className="send" disabled={!native || runtime?.state !== 'healthy' || sending || busy || (!draft.trim() && !attachments.length)} aria-label="发送消息"><Icon name="arrow" /></button></form><p className="composer-hint">最多 3 张图片 · 在空间中选择图片理解模型</p></div>
      </>}
      {page === 'cards' && <>
        <div className="page-heading"><div><div className="eyebrow">CHARACTER LIBRARY</div><h1>故事里的人<span>。</span></h1><p>人设是起点，经历让她成为自己。</p></div><button className="text-button" onClick={() => setPage('settings')}>返回空间</button></div>
        <div className="actions"><button className="primary" disabled={!native || busy} onClick={importCard}><Icon name="plus" />导入角色卡</button><button className="secondary" disabled={!native || busy} onClick={() => setCreateOpen(true)}>手动创建</button></div>
        <p className="caption">JSON / PNG / YAML · 酒馆 V1–V3 · typ0 / HDS koishi.yml<br />CHARX、压缩 PNG 元数据和第三方扩展暂不支持执行。</p>
        <div className="card-list">{cards.map((saved, index) => <article className={`character ${saved.id === selected ? 'chosen' : ''}`} key={saved.id}><div className="character-number">{String(index + 1).padStart(2, '0')}</div><div className="character-body"><div className="character-title"><h2>{saved.card.name}</h2>{saved.id === selected && <span className="tag">当前角色</span>}</div><p>{saved.card.description || saved.card.personality || '尚未填写角色描述'}</p><span className="caption">{saved.card.format.toUpperCase()} · {saved.card.lorebook ? '含世界书' : '独立人设'} · {new Date(saved.importedAt).toLocaleDateString('zh-CN')}</span><div className="card-actions"><button disabled={busy || sending || transitioning || saved.id === selected} onClick={() => switchCard(saved.id)}>{saved.id === selected ? '正在使用' : '使用这个角色'}</button><button onClick={() => setPreview({ card: saved.card, base64: '' })}>查看人设</button><button disabled={busy} onClick={() => setEditingCard(saved)}>编辑</button><button disabled={busy} className="danger" onClick={() => setDeleteTarget(saved)}>删除</button></div></div></article>)}</div>
        {!cards.length && <div className="quiet-empty">角色库还很安静。<br />为第一段故事选一个主角吧。</div>}
      </>}
      {page === 'story' && <>
        <div className="page-heading"><div><div className="eyebrow">BEYOND THE CONVERSATION</div><h1>生活的切面<span>。</span></h1><p>记住走过的日常，也读懂未说出口的心事。</p></div><span className="chapter">02 / 见闻</span></div>
        <div className="tabs"><button className={detail === 'story' ? 'active' : ''} onClick={() => setDetail('story')}>故事时间线</button><button className={detail === 'memory' ? 'active' : ''} onClick={() => setDetail('memory')}>长期记忆</button><button className={detail === 'mind' ? 'active' : ''} onClick={() => setDetail('mind')}>此刻心绪</button></div>
        {runtime?.state !== 'healthy' ? wakePanel : <>
          <div className="inline-actions"><button onClick={() => act(async () => { const result = await bridge.rpc({ method: 'story.snapshot' }); setStory(result.data as typeof story) })}>刷新</button><button onClick={() => act(async () => { await bridge.rpc({ method: story?.story?.status === 'paused' ? 'story.resume' : 'story.pause' }); const result = await bridge.rpc({ method: 'story.snapshot' }); setStory(result.data as typeof story) }, '故事状态已更新。')}>{story?.story?.status === 'paused' ? '恢复故事' : '暂停故事'}</button></div>
          {detail === 'story' ? <div className="timeline">{story?.entries.filter(entry => entry.kind === 'script' || entry.kind === 'setup').map(entry => <article key={entry.id}><time>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</time><p>{entry.content}</p></article>)}{!story?.entries.some(entry => entry.kind === 'script') && <p className="quiet-empty">还没有生成生活剧本。对话后可在这里查看。</p>}</div> : detail === 'mind' ? <div className="mind-card"><span className="eyebrow">INNER WEATHER</span><h2>{active?.card.name || '角色'}的心绪</h2><p>{story?.story?.state?.alterSystem?.emotionalOffset?.description || '心绪还没有留下记录。随着故事继续，这里会记下细微的变化。'}</p></div> : <div className="timeline"><MemoryTools key={selected} cardId={selected} bridge={bridge} facts={story?.facts || []} intents={story?.intents || []} overlay={story?.overlay?.state || {}} busy={busy} act={act} refresh={refreshStory} />{story?.memories.map(memory => <article key={`memory-${memory.id}`}><span className="eyebrow">压缩记忆 #{memory.id}</span><p>{memory.summary || memory.content}</p></article>)}{!story?.facts.length && !story?.memories.length && <p className="quiet-empty">经历积累后，记忆会在这里出现。</p>}</div>}
        </>}
      </>}
      {page === 'settings' && <>
        <div className="page-heading"><div><div className="eyebrow">YOUR OWN LITTLE WORLD</div><h1>你的小小世界<span>。</span></h1><p>安放故事里的人，也安排这个世界的节奏。</p></div><span className="chapter">04 / 空间</span></div>
        <button className="space-link" onClick={() => setPage('cards')}><div><span className="eyebrow">PEOPLE & STORIES</span><h2>故事里的人</h2><p>{cards.length} 位角色 · {active?.card.name || '等待第一位主角'}</p></div><Icon name="arrow" /></button>
        <section><div className="section-title"><h2>故事的节奏</h2><span className="tag">{runtimeLabel}</span></div>{healthy ? <div className="actions"><button className="secondary" disabled={busy || sending} onClick={() => act(async () => { await bridge.stop(); setRuntime(await bridge.status()) }, '故事暂时歇息，经历都已留存。')}>让故事休息一下</button></div> : wakePanel}</section>
        <div className="save-status" role="status"><span>{native ? saveState : '界面预览 · 设置不会保存'}</span>{saveError && <><p className="error">{saveError}</p><button className="text-button" disabled={busy} onClick={() => void persistSettings().catch(() => {})}>重试保存</button></>}</div>
        <ModelCenter settings={settings} setSettings={setSettings} native={native} busy={busy} bridge={bridge} act={act} notify={setNotice} />
        <section className="settings-group"><details><summary><span><b>故事与身份</b><small>你的称呼、人设与持续生活</small></span></summary><label>你的称呼<input value={settings.userName} onChange={event => setSettings({ ...settings, userName: event.target.value })} maxLength={128} /></label><label>你的故事人设<textarea rows={3} value={settings.userProfile} onChange={event => setSettings({ ...settings, userProfile: event.target.value })} maxLength={12000} placeholder="你在这个世界中的身份、与角色的关系…" /></label><label className="toggle"><input type="checkbox" checked={settings.autoAdvance} onChange={event => setSettings({ ...settings, autoAdvance: event.target.checked })} /><div><b>持续生活与主动联系</b><p>默认关闭。开启后 HDS 可在通知服务存活时自动调用模型，产生 API 费用。</p></div></label><p className="caption">离开输入框时自动保存。这里的人设用于新故事，已有故事会保留原来的设定。</p></details></section><AppearanceSettings appearance={appearance} native={native} busy={busy} act={act} /><StoryManagement bridge={bridge} cardId={selected} name={active?.card.name || ""} native={native} healthy={healthy} busy={busy || sending || transitioning} act={act} changed={storyChanged} notify={setNotice} />
        <section className="settings-group"><details><summary><span><b>核心维护与诊断</b><small>运行组件、设备信息与日志</small></span></summary><p className="caption">遇到运行问题时，可重新准备核心组件。角色与故事会保留。</p><button className="secondary" disabled={!native || busy || transitioning || healthy} onClick={() => act(async () => { await bridge.install(); setRuntime(await bridge.status()) })}>重新准备核心组件</button><h3>设备与诊断</h3><dl><div><dt>设备</dt><dd>{runtime?.device.model || '待原生读取'}</dd></div><div><dt>Android / API</dt><dd>{runtime ? `${runtime.device.android} / ${runtime.device.sdk}` : '—'}</dd></div><div><dt>ABI / 页大小</dt><dd>{runtime ? `${runtime.device.abi} / ${runtime.device.pageSize} B` : '—'}</dd></div><div><dt>可用空间</dt><dd>{runtime ? `${(runtime.device.availableBytes / 1024 ** 3).toFixed(2)} GiB` : '—'}</dd></div><div><dt>应用 / HDS</dt><dd>{runtime?.version || '—'} / rc51</dd></div></dl><div className="actions"><button className="secondary" disabled={!native || busy} onClick={() => act(async () => setDiagnostic(await bridge.diagnostics({ probe: true })))}>查看安装诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(() => bridge.copyDiagnostics(), '安装诊断已复制，不含密钥、人设和聊天。')}>复制诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(async () => { const result = await bridge.saveDiagnostics(); setNotice(result.cancelled ? '已取消保存' : '安装诊断已保存。') })}>保存诊断</button></div>{diagnostic && <pre aria-label="安装诊断">{JSON.stringify(diagnostic, null, 2)}</pre>}<details><summary>查看运行日志</summary><pre role="log" aria-label="运行日志">{runtime?.logs.join('\n') || '暂无日志'}</pre></details><p className="caption">请反馈错误阶段、页大小与日志；分享前检查是否包含个人聊天内容。16 KB 页、后台存活与 QQ 能力均需真机验证。</p></details></section>
      </>}
    </main>
    <nav ref={navigation} aria-label="主导航">{(['chat', 'story', 'inbox', 'settings'] as Page[]).map(key => <button key={key} className={key === page || (key === 'settings' && page === 'cards') ? 'active' : ''} onClick={() => setPage(key)} aria-current={key === page ? 'page' : undefined}><Icon name={key} /><span>{labels[key]}</span></button>)}</nav>
    {switcher && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="选择角色或故事"><div className="section-title"><h2>下一页，和谁一起？</h2><button autoFocus aria-label="关闭角色选择" onClick={() => setSwitcher(false)}>×</button></div><p className="caption">每个人的经历独立留存，切换后可以继续上次的故事。</p>{cards.map(saved => <button className="story-choice" disabled={busy || sending || transitioning} key={saved.id} onClick={() => switchCard(saved.id)}><span>{saved.card.name}</span><small>{saved.id === selected ? '当前故事' : '继续故事 →'}</small></button>)}<button className="secondary wide" onClick={() => { setSwitcher(false); setPage('cards') }}>导入、创建与管理角色</button></section></div>}
    {editingCard && <CardEditor key={editingCard.id} saved={editingCard} busy={busy} close={() => setEditingCard(null)} save={async card => { setBusy(true); try { await bridge.updateCard({ id: editingCard.id, card }); setEditingCard(null); await refreshCards(); setNotice('人设已修改，剧情与记忆保留。重新启动 HDS 后生效。') } finally { setBusy(false) } }} />}
    {deleteTarget && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="删除角色确认"><h2>删除「{deleteTarget.card.name}」？</h2><p>将从角色库移除。已有剧情、记忆与原文件仍保留在本机，重新导入原文件可恢复。当前角色运行时会先停止 HDS。</p><div className="actions"><button className="secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>取消</button><button className="primary" disabled={busy} onClick={() => void act(async () => { const id = deleteTarget.id; await bridge.deleteCard({ id }); setDeleteTarget(null); if (selected === id) { setMessages([]); setStory(null) } await refreshCards() }, '角色已从库中移除，历史保留。')}>确认删除</button></div></section></div>}
    {importChoices.length > 0 && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="选择 HDS 人设"><div className="section-title"><h2>文件包含多个人设</h2><button aria-label="取消导入" onClick={() => setImportChoices([])}>×</button></div><p className="caption">选择要导入的 HDS 实例。</p>{importChoices.map((choice, index) => <button key={index} className="secondary wide" onClick={() => { setPreview(choice); setImportChoices([]) }}>{index + 1}. {choice.card.name}</button>)}</section></div>}
    {preview && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="角色卡预览"><div className="section-title"><span className="eyebrow">CHARACTER / {preview.card.format.toUpperCase()}</span><button aria-label="关闭" onClick={() => setPreview(null)}>×</button></div><h1>{preview.card.name}</h1><p className="preview-text">{preview.card.description}</p>{preview.card.personality && <><h3>性格</h3><p className="preview-text">{preview.card.personality}</p></>}{preview.card.firstMessage && <><h3>开场白</h3><p className="preview-text">{preview.card.firstMessage}</p></>}<h3>兼容说明</h3><ul>{preview.card.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>{preview.base64 && <button className="primary wide" disabled={busy} onClick={savePreview}>保存并使用这个角色<Icon name="arrow" /></button>}</section></div>}
    {createOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="创建角色"><div className="section-title"><h2>写下一个人</h2><button aria-label="关闭" onClick={() => setCreateOpen(false)}>×</button></div><label>角色名称<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={128} /></label><label>角色描述<textarea rows={6} value={newProfile} onChange={event => setNewProfile(event.target.value)} maxLength={262144} placeholder="身份、性格、说话方式与生活背景…" /></label><button className="primary wide" disabled={!newName.trim() || !newProfile.trim()} onClick={() => { const raw = JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: newName.trim(), description: newProfile, personality: '', scenario: '', first_mes: '', mes_example: '', extensions: {} } }); const bytes = new TextEncoder().encode(raw); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); setPreview({ card: parseCard(bytes), base64: btoa(binary) }); setCreateOpen(false); setNewName(''); setNewProfile('') }}>预览角色<Icon name="arrow" /></button></section></div>}
  </div></>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

import './glass.css'
