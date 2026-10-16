import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { fromBase64, parseCard, type Card } from '../../packages/card-format'
import type { QQConversation, SchedulingStatus, Message, ModelSettings, NativeBridge, RuntimeStatus, SavedCard } from '../../packages/contracts'
import { messageImages, imageEntryReason, visionProjection, visionRouteReason, refreshCoordinator, mergeMessages, localRequestFailure } from '../../packages/contracts'
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
import { LifeSettings } from './LifeSettings'
import { MessageStatus, TypingBubble } from './MessageStatus'
import { createReplyWatermarks } from './message-state'
import { NotificationSettings } from './NotificationSettings'
import { settingEffects, settingEffectLabels } from './setting-effects'
import { createDraftStore, composerEnter, type Draft } from './composer-state'
import { clipboardJpeg } from './clipboard-image'
import { MessageContent } from './MessageContent'
import { VoiceBubble, VoiceSettings, useVoices } from './Voice'
import { messageAudio } from '../../packages/contracts/voice'
import { StickerDrawer, StickerManager, stickerSource } from './Stickers'
import { readLibrary, stickerEntryVisible, stickerSyncPacks, stickerMessageKey, libraryBytes, useSticker, type StickerLibrary, type StickerAsset } from './sticker-state'

const effectCaption = (key: keyof typeof settingEffects) => settingEffectLabels[settingEffects[key].timing]

const bridge = registerPlugin<NativeBridge>('HdsRuntime')
type Page = 'chat' | 'inbox' | 'cards' | 'story' | 'settings'
const labels: Record<Page, string> = { chat: '故事', inbox: '信箱', cards: '角色', story: '见闻', settings: '空间' }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
function Icon({ name }: { name: Page | 'arrow' | 'plus' }) {
  const paths = { inbox: 'M3 5h18v14H3V5Zm0 0 9 8 9-8', chat: 'M5 4h14v12H9l-4 4V4Z', cards: 'M13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 20v-2a7 7 0 0 1 14 0v2M17 4a3 3 0 0 1 0 6M21 20v-2a7 7 0 0 0-4-6', story: 'M5 5h14M5 12h10M5 19h14', settings: 'M4 7h16M4 17h16M9 4v6M15 14v6', arrow: 'M5 12h14M13 6l6 6-6 6', plus: 'M12 5v14M5 12h14' }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
const MessageRow = React.memo(function MessageRow({ message, userName, characterName, lastCharacterReplyTs, onRetry, retryDisabled, sticker, entrance, voiceEnabled }: { voiceEnabled?: boolean; sticker?: StickerAsset; entrance?: number; message: Message; userName: string; characterName: string; lastCharacterReplyTs: number; onRetry: (message: Message) => void; retryDisabled: boolean }) {
  const opening = message.status === 'card-opening'
  const characterSticker = message.direction === 'character' && !message.content.trim() && messageImages(message.images).length > 0
  const isSticker = !!sticker || characterSticker
  return <article data-read-anchor={`message-${message.id}`} style={entrance === undefined ? undefined : { '--i': entrance } as React.CSSProperties} className={`message${isSticker ? ' sticker-message' : ''}${entrance === undefined ? '' : ' message-enter'} ${message.direction === 'character' ? 'character-reply' : message.direction}`}>
    {opening && <MessageStatus message={message} />}
    <div className="message-label">{message.direction === 'user' ? userName : characterName}<time>{new Date(message.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
    <div className={isSticker ? "sticker-body" : "bubble"}>{!isSticker && (message.direction === 'character' ? voiceEnabled && messageAudio(message.audio) ? <VoiceBubble audio={messageAudio(message.audio)!} content={message.content} bridge={bridge} /> : <MessageContent message={message} /> : message.content)}{sticker ? <StoredImage id={messageImages(message.images)[0]} bridge={bridge} source={stickerSource(sticker)} /> : messageImages(message.images).map(id => <StoredImage key={id} id={id} bridge={bridge} />)}</div>
    {!opening && <MessageStatus message={message} lastCharacterReplyTs={lastCharacterReplyTs} onRetry={() => onRetry(message)} disabled={retryDisabled} />}
  </article>
})
function App() {
  const [page, updatePage] = useState<Page>('chat')
  const [inboxUnread, setInboxUnread] = useState(0)
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [cards, setCards] = useState<SavedCard[]>([])
  const [selected, setSelected] = useState('')
  const selectedRef = useRef(selected)
  const openNotification = useRef<(cardId: string) => Promise<void>>(async () => {})
  const replyWatermarks = useRef(createReplyWatermarks())
  const lastCharacterReplyTs = replyWatermarks.current.get(selected)
  const [settings, setSettings] = useState<ModelSettings>({ providers: [newProvider()], modelOptions: defaultOptions, userName: '我', userProfile: '', autoAdvance: false })
  const [messages, setMessages] = useState<Message[]>([])
  const [story, setStory] = useState<{ story?: { status: string; state?: { alterSystem?: { emotionalOffset?: { description: string; direction: string } | null } } }; schedulingStatus?: SchedulingStatus[]; entries: { id: number; content: string; occurredAt: string; kind: string }[]; facts: Fact[]; memories: { id: number; content: string; summary?: string }[]; intents?: { id: number; summary: string; notBefore?: string; type?: string; payload?: { kind?: string } }[]; overlay?: { state: Record<string, unknown> }; promptTrace: string[] } | null>(null)
  const draftStore = useRef(createDraftStore(localStorage))
  const draftCache = useRef(new Map<string, Draft>())
  const [, redrawDraft] = useState(0)
  const getDraft = (id: string) => {
    if (!draftCache.current.has(id)) draftCache.current.set(id, draftStore.current.read(id))
    return draftCache.current.get(id)!
  }
  const { content: draft, attachments } = getDraft(selected)
  const updateDraft = (patch: Partial<Draft>, id = selectedRef.current) => {
    if (!id) return
    const next = { ...getDraft(id), ...patch }
    draftCache.current.set(id, next)
    try { draftStore.current.write(id, next) } catch { setNotice('本机草稿空间不足，当前输入仍保留，请发送后清理存储。') }
    redrawDraft(value => value + 1)
  }
  const setDraft = (content: string) => updateDraft({ content })
  const setAttachments = (value: Draft['attachments'] | ((current: Draft['attachments']) => Draft['attachments'])) => updateDraft({ attachments: typeof value === 'function' ? value(getDraft(selectedRef.current).attachments) : value })
  const composing = useRef(false)
  const sendLock = useRef(false)
  const [stickers, setStickers] = useState(() => readLibrary(localStorage))
  const stickersRef = useRef(stickers)
  const saveStickers = (value: StickerLibrary) => {
    localStorage.setItem('hds-stickers-v1', JSON.stringify(value))
    stickersRef.current = value; setStickers(value)
  }
  const [stickerDrawer, setStickerDrawer] = useState(false)
  const [stickerManager, setStickerManager] = useState(false)
  useEffect(() => { composing.current = false; setStickerDrawer(false) }, [selected, page])
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'failed' | 'unknown' | 'accepted'>('idle')
  const [retryTarget, setRetryTarget] = useState<Message | null>(null)
  const [newMessages, setNewMessages] = useState(0)
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
  const [detail, updateDetail] = useState<'story' | 'memory' | 'mind'>('story')
  const [switcher, setSwitcher] = useState(false)
  const [saveState, setSaveState] = useState('设置自动保存')
  const [saveError, setSaveError] = useState('')
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const composer = useRef<HTMLTextAreaElement>(null)
  const focusAfterWake = useRef(false)
  const launchedSettings = useRef('')
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const savedSettings = useRef('')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const runtimeRef = useRef(runtime)
  runtimeRef.current = runtime
  const profileRevision = useRef(0)
  const imageLock = useRef(false)
  const pending = useRef<{ requestId: string; content: string; images?: string[] } | null>(null)
  const sendRef = useRef<(message?: Message) => Promise<void>>(async () => {})
  const retryMessage = useCallback((message: Message) => { void sendRef.current(message) }, [])
  const active = cards.find(card => card.id === selected)
  const native = Capacitor.isNativePlatform()
  const voices = useVoices(bridge, native, setNotice)
  const appearance = useAppearance(bridge, native, setNotice)
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null)
  const navigation = useRef<HTMLElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const pageRef = useRef(page)
  pageRef.current = page
  const storyLifetimes = useRef(new Map<string, number>())
  const positions = useRef(new Map<string, { y: number; anchor?: string; offset?: number; drawers: boolean[] }>())
  const nearBottom = useRef(true)
  const forceBottom = useRef(false)
  const userMoved = useRef(false)
  const restored = useRef('')
  const locationKey = `${selected}:${storyLifetimes.current.get(selected) ?? 0}:${page}:${page === 'story' ? detail : ''}`
  const savePosition = () => {
    const anchor = [...document.querySelectorAll<HTMLElement>('[data-read-anchor]')].find(element => element.getBoundingClientRect().bottom > 0)
    positions.current.set(locationKey, { y: window.scrollY, anchor: anchor?.dataset.readAnchor, offset: anchor?.getBoundingClientRect().top, drawers: [...document.querySelectorAll<HTMLDetailsElement>('.memory-drawer')].map(element => element.open) })
  }
  const setPage = (next: Page) => { savePosition(); updatePage(next) }
  const setDetail = (next: typeof detail) => { savePosition(); updateDetail(next) }
  const toLatest = () => { forceBottom.current = true; nearBottom.current = true; userMoved.current = false; setNewMessages(0); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
  useEffect(() => {
    const onScroll = () => { if (pageRef.current !== 'chat') return; nearBottom.current = document.documentElement.scrollHeight - innerHeight - scrollY < 96; if (nearBottom.current) setNewMessages(0) }
    const moved = () => { userMoved.current = true; forceBottom.current = false }
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('wheel', moved, { passive: true }); window.addEventListener('touchstart', moved, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('wheel', moved); window.removeEventListener('touchstart', moved) }
  }, [])
  useLayoutEffect(() => {
    if ((page === 'story' && !story) || (page === 'chat' && !messages.length)) return
    if (restored.current === locationKey) return
    restored.current = locationKey; userMoved.current = false
    const saved = positions.current.get(locationKey)
    const restore = () => {
      if (userMoved.current) return
      if (saved) {
        document.querySelectorAll<HTMLDetailsElement>('.memory-drawer').forEach((element, index) => { element.open = saved.drawers[index] ?? false })
        const anchor = [...document.querySelectorAll<HTMLElement>('[data-read-anchor]')].find(element => element.dataset.readAnchor === saved.anchor)
        window.scrollTo(0, anchor && saved.offset !== undefined ? scrollY + anchor.getBoundingClientRect().top - saved.offset : saved.y)
      } else window.scrollTo(0, page === 'chat' || (page === 'story' && detail === 'story') ? document.documentElement.scrollHeight : 0)
      if (page === 'chat') nearBottom.current = document.documentElement.scrollHeight - innerHeight - scrollY < 96
    }
    restore(); const frame = requestAnimationFrame(restore)
    const observer = new ResizeObserver(restore); const main = document.querySelector('main'); if (main) observer.observe(main)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [locationKey, !!story, !!messages.length])
  useLayoutEffect(() => {
    if (page !== 'chat') return
    const follow = () => { if (nearBottom.current || forceBottom.current) { window.scrollTo(0, document.documentElement.scrollHeight); forceBottom.current = false } }
    follow(); const observer = new ResizeObserver(follow); const list = document.querySelector('.messages'); if (list) observer.observe(list)
    return () => observer.disconnect()
  }, [page, messages])
  useLayoutEffect(() => {
    const element = composer.current
    if (!element) return
    const resize = () => { element.style.height = 'auto'; element.style.height = `${Math.max(42, Math.min(150, element.scrollHeight))}px`; element.style.overflowY = element.scrollHeight > 150 ? 'auto' : 'hidden' }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [draft, selected, page, appearance.value.fontSize])
  const act = async (task: () => Promise<unknown>, success?: string) => {
    setBusy(true); setNotice('')
    try { await task(); if (success) setNotice(success) } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  const refreshCards = async () => { const data = await bridge.cards(); setCards(data.cards); const prefs = await bridge.settings(); selectedRef.current = prefs.activeCard; setSelected(prefs.activeCard) }
  const storyChanged = async (historyReplaced = false) => {
    localStorage.removeItem(`hds-maintenance-${selected}`)
    if (historyReplaced) replyWatermarks.current.clear(selected)
    for (const key of positions.current.keys()) if (key.startsWith(`${selected}:`)) positions.current.delete(key)
    storyLifetimes.current.set(selected, (storyLifetimes.current.get(selected) ?? 0) + 1); restored.current = ''; profileRevision.current++; pending.current = null; setRetryTarget(null); setRequestState('idle'); setMessages([]); setStory(null)
    await refreshCards(); setRuntime(await bridge.status()); setRestartNeeded(false)
  }
  const storyReads = useRef(refreshCoordinator(async () => (await bridge.rpc({ method: 'story.snapshot' })).data as typeof story, (value, revision) => { if (revision === profileRevision.current) setStory(value) }))
  const refreshStory = () => storyReads.current(profileRevision.current, true)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const historyReads = useRef(refreshCoordinator(async () => {
    const cardId = selectedRef.current
    return { cardId, rows: (await bridge.rpc({ method: 'messages.history' })).data as Message[] }
  }, ({ cardId, rows: value }, revision) => {
    if (revision !== profileRevision.current || !cardId || cardId !== selectedRef.current) return
    replyWatermarks.current.observe(cardId, value)
    const request = pending.current
    if (request && value.some(row => row.id === request.requestId && row.status === 'accepted')) {
      pending.current = null; setRetryTarget(null); setRequestState('accepted')
      if (!stickersRef.current.messages[stickerMessageKey(cardId, request.requestId)] && getDraft(cardId).content.trim() === request.content && JSON.stringify(getDraft(cardId).attachments.map(image => image.id)) === JSON.stringify(request.images ?? [])) { setDraft(''); setAttachments([]) }
    }
    const previous = messagesRef.current
    const next = mergeMessages(previous, value)
    if (previous.length && !nearBottom.current) { const ids = new Set(previous.map(row => row.id)); const count = next.filter(row => !ids.has(row.id)).length; if (count) setNewMessages(current => current + count) }
    messagesRef.current = next; setMessages(next)
  }))
  const refreshHistory = () => historyReads.current(profileRevision.current)
  useEffect(() => {
    if (!native) { setNotice('浏览器预览模式：原生运行与存储不可用，不显示模拟成功结果。'); return }
    void Promise.all([bridge.settings(), bridge.cards()]).then(([prefs, library]) => { savedSettings.current = JSON.stringify(prefs); setSettings(prefs); setSettingsReady(true); selectedRef.current = prefs.activeCard; setSelected(prefs.activeCard); setCards(library.cards) }).catch(error => setNotice(errorText(error)))
    let stopped = false, polling = false
    const poll = async () => {
      if (polling || stopped) return
      polling = true
      try {
        let status = await bridge.status()
        if (stopped) return
        if (savedSettings.current) {
          const launch = await bridge.notificationLaunch()
          if (launch.cardId) { await openNotification.current(launch.cardId); status = await bridge.status() }
        }
        setRuntime(status)
        if (status.state === 'healthy') {
          await refreshHistory()
        }
      } catch (error) { if (!stopped) setNotice(errorText(error)) } finally { polling = false }
    }
    void poll(); const interval = setInterval(() => void poll(), 1000)
    return () => { stopped = true; clearInterval(interval) }
  }, [native])
  useEffect(() => {
    if (page !== 'story' || runtime?.state !== 'healthy') return
    let cancelled = false, loading = false
    const refresh = async () => {
      if (loading) return
      loading = true
      try { await storyReads.current(profileRevision.current) }
      catch (error) { if (!cancelled) setNotice(errorText(error)) }
      finally { loading = false }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [page, runtime?.state, selected])
  useEffect(() => {
    if (!native || page !== 'settings' || runtime?.state !== 'healthy') { setInboxUnread(0); return }
    let cancelled = false, running = false
    const poll = async () => {
      if (running) return
      running = true
      try {
        const result = await bridge.rpc({ method: 'qq.conversations' })
        if (!cancelled) setInboxUnread((result.data as QQConversation[]).reduce((total, row) => total + row.unread, 0))
      } catch { if (!cancelled) setInboxUnread(0) }
      finally { running = false }
    }
    void poll(); const timer = setInterval(() => void poll(), 2000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [native, page, runtime?.state])
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
      setRestartNeeded(!!launchedSettings.current && JSON.stringify(settingsRef.current) !== launchedSettings.current)
      if (page === 'chat') { composer.current?.focus(); focusAfterWake.current = false }
    }
    if (runtime?.state === 'failed') focusAfterWake.current = false
  }, [runtime?.state, page])
  useEffect(() => {
    if (!native || !settingsReady || runtime?.state !== 'healthy') return
    const revision = profileRevision.current
    let cancelled = false
    void Promise.resolve().then(() => bridge.rpc({ method: 'preset.syncStatus', payload: { currentVision: visionProjection(settingsRef.current) } })).then(result => {
      if (!cancelled && revision === profileRevision.current && (result.data as { visionRestartRequired?: boolean }).visionRestartRequired) setRestartNeeded(true)
    }).catch(() => { if (!cancelled && revision === profileRevision.current) setNotice('无法核对核心识图配置，选图前会重新检查。') })
    return () => { cancelled = true }
  }, [native, settingsReady, runtime?.state, selected])
  const wake = () => act(async () => {
    if (!active) { setSwitcher(true); return }
    if (!settingsRef.current.providers.some(row => row.enabled && row.useForMain && row.endpoint && row.model)) { setPage('settings'); setNotice('为故事选择一个模型，就可以开始了。'); return }
    await persistSettings()
    focusAfterWake.current = true
    try { launchedSettings.current = JSON.stringify(settingsRef.current); await bridge.syncStickerLibrary({ packs: stickerSyncPacks(stickersRef.current) }); await bridge.start(); setRuntime(await bridge.status()) }
    catch (error) { focusAfterWake.current = false; throw error }
  })
  const restart = () => act(async () => {
    await persistSettings()
    await bridge.stop(); setRuntime(await bridge.status())
    focusAfterWake.current = true
    launchedSettings.current = JSON.stringify(settingsRef.current); await bridge.syncStickerLibrary({ packs: stickerSyncPacks(stickersRef.current) }); await bridge.start(); setRuntime(await bridge.status())
  })
  const switchCard = (id: string) => act(async () => {
    if (id === selectedRef.current) { setSwitcher(false); return }
    const resume = (await bridge.status()).state === 'healthy'
    savePosition(); profileRevision.current++; selectedRef.current = ''
    try { await bridge.selectCard({ id }) } catch (error) { selectedRef.current = selected; throw error }
    profileRevision.current++
    pending.current = null; setRetryTarget(null); setRequestState('idle'); setMessages([]); setStory(null)
    await refreshCards(); setRuntime(await bridge.status()); setSwitcher(false)
    if (resume) { await persistSettings(); focusAfterWake.current = true; launchedSettings.current = JSON.stringify(settingsRef.current); await bridge.syncStickerLibrary({ packs: stickerSyncPacks(stickersRef.current) }); await bridge.start(); setRuntime(await bridge.status()) }
  })
  openNotification.current = async (cardId: string) => {
    if (!(await bridge.cards()).cards.some(card => card.id === cardId)) { setNotice('这个角色已不在角色库中。'); return }
    await switchCard(cardId)
    if (selectedRef.current !== cardId) return
    // A notification explicitly asks for the latest reply, including when the
    // same conversation was previously left scrolled into older history.
    for (const key of positions.current.keys()) if (key.startsWith(`${cardId}:`)) positions.current.delete(key)
    restored.current = ''; nearBottom.current = true; forceBottom.current = true; userMoved.current = false
    setNewMessages(0); setSwitcher(false); updatePage('chat')
    if ((await bridge.status()).state === 'healthy') await refreshHistory()
    requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight))
  }
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
  const send = async (retry?: Message, sticker?: { packId: string; asset: StickerAsset }) => {
    const content = sticker ? '' : retry ? retry.content : draft.trim()
    const imageIds = sticker ? [] : retry ? messageImages(retry.images) : attachments.map(image => image.id)
    if ((!sticker && !content && !imageIds.length) || sendLock.current || busy || runtime?.state !== 'healthy') return
    sendLock.current = true
    const request = retry ? { requestId: retry.id, content, images: imageIds } : !sticker && pending.current?.content === content && JSON.stringify(pending.current.images || []) === JSON.stringify(imageIds) ? pending.current : { requestId: crypto.randomUUID(), content, images: imageIds }
    if (sticker) pending.current = null
    else { pending.current = request; setRetryTarget(retry ?? null) }
    setSending(true); setRequestState('sending'); setNotice(''); setStickerDrawer(false)
    const revision = profileRevision.current
    const cardId = selectedRef.current
    try {
      if (imageIds.length || sticker) {
        await persistSettings(); const version = JSON.stringify(settingsRef.current); await checkVision()
        if (revision !== profileRevision.current || runtimeRef.current?.state !== 'healthy' || version !== JSON.stringify(settingsRef.current)) throw new Error('设置或运行状态已更改，请检查后重试')
      }
      if (sticker) {
        const image = await bridge.stickerImage({ id: sticker.asset.id })
        const upload = await bridge.rpc({ method: 'images.upload', payload: { dataUri: image.dataUri } })
        if (revision !== profileRevision.current) return
        request.images = [(upload.data as { id: string }).id]
        const library = useSticker(stickersRef.current, sticker.packId, sticker.asset.id)
        saveStickers({ ...library, messages: { ...library.messages, [stickerMessageKey(cardId, request.requestId)]: sticker.asset } })
      }
      pending.current = request
      setRetryTarget(sticker ? { id: request.requestId, content: '', images: request.images, direction: 'user', occurredAt: new Date().toISOString(), status: 'failed' } : retry ?? null)
      await bridge.rpc({ method: 'messages.sendLocal', payload: request })
      // A notification may select another card while the RPC is in flight.
      // Clear the acknowledged card's matching draft before the UI revision guard.
      const sentDraft = getDraft(cardId)
      if (!retry && !sticker && sentDraft.content.trim() === content && JSON.stringify(sentDraft.attachments.map(image => image.id)) === JSON.stringify(imageIds)) updateDraft({ content: '', attachments: [] }, cardId)
      if (revision !== profileRevision.current) return
      forceBottom.current = true; setRequestState('accepted')
      pending.current = null; setRetryTarget(null); await historyReads.current(revision, true)
    } catch (error) {
      if (revision === profileRevision.current) {
        if (messagesRef.current.some(row => row.id === request.requestId && row.status === 'accepted')) { setRequestState('accepted'); setRetryTarget(null); setNotice('') }
        else if (sticker && !pending.current) { setRequestState('idle'); setNotice(`${errorText(error)}；请重新点击表情发送。`) }
        else { setRequestState(localRequestFailure(error)); setNotice(`${errorText(error)}；草稿已保留，可以重试。`) }
      }
    } finally { sendLock.current = false; setSending(false) }
  }
  sendRef.current = send
  const checkVision = async () => {
    const desired = settingsRef.current
    const result = await bridge.rpc({ method: 'preset.syncStatus', payload: { currentVision: visionProjection(desired) } })
    const status = result.data as { visionRestartRequired?: boolean; activeVision?: ReturnType<typeof visionProjection> }
    if (status.visionRestartRequired !== false || !status.activeVision) throw new Error('识图配置尚未生效，请先重启核心；无法查询时请稍后重试')
    const reason = visionRouteReason(status.activeVision)
    if (reason) throw new Error(reason)
  }
  const attachmentReason = imageEntryReason({ native, healthy: runtime?.state === 'healthy', busy, sending, count: attachments.length, enabled: settings.modelOptions.visionEnabled === true })
  const pickImage = async (pasted?: File[]) => {
    if (imageLock.current) return
    if (attachmentReason) { setNotice(attachmentReason); if (!settingsRef.current.modelOptions.visionEnabled) setPage('settings'); return }
    imageLock.current = true
    const revision = profileRevision.current
    const fingerprint = JSON.stringify(settingsRef.current)
    // Saving may replace secrets/public rows; capture the post-save version for subsequent checks.
    let savedFingerprint = fingerprint
    const stillCurrent = () => revision === profileRevision.current && runtimeRef.current?.state === 'healthy' && JSON.stringify(settingsRef.current) === savedFingerprint
    setBusy(true); setNotice('')
    try {
      const original = settingsRef.current
      await persistSettings()
      if (revision !== profileRevision.current || runtimeRef.current?.state !== 'healthy') return
      // A concurrent edit must not open the picker for a different route.
      if (settingsRef.current !== original && savedSettings.current !== JSON.stringify(settingsRef.current)) return
      savedFingerprint = JSON.stringify(settingsRef.current)
      await checkVision()
      if (!stillCurrent()) return
      const result = pasted ? { cancelled: false, images: await Promise.all(pasted.slice(0, 3 - attachments.length).map(async file => ({ dataUri: await clipboardJpeg(file) }))), truncated: pasted.length > 3 - attachments.length } : await bridge.pickImage({ limit: 3 - attachments.length })
      if (result.cancelled || !stillCurrent()) return
      const images = result.images ?? (result.dataUri ? [{ dataUri: result.dataUri }] : [])
      const errors = (result.errors ?? []).map(error => `第 ${error.index + 1} 张：${error.message}`)
      for (const image of images.slice(0, 3 - attachments.length)) {
        if (!stillCurrent()) return
        try {
          const upload = await bridge.rpc({ method: 'images.upload', payload: { dataUri: image.dataUri } })
          if (!stillCurrent()) return
          const id = (upload.data as { id: string }).id
          setAttachments(current => current.some(item => item.id === id) ? current : [...current, { id, dataUri: image.dataUri }].slice(0, 3))
        } catch { errors.push('图片上传失败，已成功的图片仍保留') }
      }
      if (!images.length && !errors.length) errors.push('图库未返回图片，请重新选择')
      if (result.truncated || images.length > 3 - attachments.length) errors.push('已按剩余名额截取图片，最多 3 张')
      if (errors.length) setNotice(errors.join('；'))
    } catch (error) { if (revision === profileRevision.current) setNotice(errorText(error)) }
    finally { imageLock.current = false; setBusy(false) }
  }
  const transitioning = ['installing', 'starting', 'stopping'].includes(runtime?.state || '')
  const healthy = runtime?.state === 'healthy'
  const modelReady = settings.providers.some(row => row.enabled && row.useForMain && row.endpoint && row.model)
  const runtimeLabel = !native ? '界面预览' : healthy ? '随时在线 · 故事继续' : runtime?.state === 'installing' ? '正在准备核心组件' : runtime?.state === 'starting' ? '正在醒来…' : runtime?.state === 'stopping' ? '正在保存故事…' : runtime?.state === 'failed' ? '唤醒未完成 · 可重试' : '正在休息中'
  const wakePanel = <div className={`wake-panel ${transitioning ? 'waking' : ''}`} role="status"><div><b>{active?.card.name || '故事'} · {runtimeLabel}</b><p>{runtime?.state === 'installing' ? '首次准备约 1 分钟，请稍候…' : runtime?.state === 'starting' ? '正在翻开属于你们的这一页。' : '之前的经历留在这里，下一句话由你开始。'}</p></div>{transitioning ? <progress aria-label={runtimeLabel} /> : <button className="primary wake-button" disabled={!native || busy || !settingsReady} onClick={wake}>{!active ? '选择主角' : !modelReady ? '连接故事模型' : runtime?.state === 'failed' ? '再次唤醒' : '点击唤醒'}<Icon name="arrow" /></button>}{runtime?.state === 'installing' && <button className="text-button" onClick={() => act(() => bridge.cancelInstall())}>取消准备</button>}{runtime?.error && <p className="error">{runtime.error}</p>}</div>
  return <>
    {appearance.value.backgroundData && <BackgroundImage source={appearance.value.backgroundData} opacity={appearance.value.backgroundOpacity} blur={appearance.value.backgroundBlur} failed={() => setNotice('背景图片无法显示，请在界面设置中重新选择图片。')} />}
    <div className="app">
    <header><div className="wordmark">HDS<span>INTERLUDE</span></div><div className="header-actions"><button className="character-library" aria-label="故事里的人" title="故事里的人" onClick={() => setPage('cards')}><Icon name="cards" /></button><button className={`status ${runtime?.state === 'healthy' ? 'online' : ''}`} disabled={busy || transitioning || (native && !settingsReady)} onClick={() => healthy ? setPage('chat') : native ? void wake() : setPage('settings')}><i />{runtimeLabel}</button></div></header>
    <main key={page} data-page={page} onBlurCapture={() => { void persistSettings().catch(() => {}) }}>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {restartNeeded && <div className="restart-banner" role="status"><div><b>新配置已就绪</b><span>重启后生效，剧情与记忆会保留。</span></div><button disabled={busy || sending || transitioning} onClick={restart}>立即重启生效</button></div>}
      {page === 'inbox' && <Inbox bridge={bridge} healthy={runtime?.state === 'healthy'} native={native} configure={() => setPage('settings')} />}
      {page === 'chat' && <>
        <div className="page-heading"><div><div className="eyebrow">A LIFE IN PROGRESS</div><h1><button className="character-switch" aria-label="切换角色或故事" onClick={() => setSwitcher(true)}>{active?.card.name || '此刻之外'}<span aria-hidden="true">⌄</span></button></h1><p>{active ? '从一句话开始，让故事慢慢发生。' : '一个角色，一段继续发生的日常。'}</p></div><span className="chapter">01 / 故事</span></div>
        {!messages.length && requestState !== 'sending' ? <div className="empty-chat"><div className="empty-art"><span /><span /><span /><b>未完待续</b></div><h2>{active ? healthy ? '故事正在继续' : '等你轻轻唤醒' : '先认识一个角色'}</h2><p>{active ? '那些一起经历的日常，都值得被记住。' : '导入一张角色卡，或亲手写下一个人。让日常从这里开始。'}</p>{!active && <button className="primary" onClick={() => setSwitcher(true)}>选择故事的主角<Icon name="arrow" /></button>}</div> : <div className="messages">{messages.map((message, index) => <MessageRow voiceEnabled={voices.state.characters[selected]?.enabled === true} entrance={index >= messages.length - 6 ? Math.max(0, index - Math.max(0, messages.length - 6)) : undefined} sticker={message.direction === 'user' ? stickers.messages[stickerMessageKey(selected, message.id)] : undefined} key={message.id} message={message} userName={settings.userName} characterName={active?.card.name || ''} lastCharacterReplyTs={lastCharacterReplyTs} onRetry={retryMessage} retryDisabled={sending || busy || !healthy || message.direction !== 'user'} />)}<TypingBubble requestState={requestState} /><div ref={scroll} /></div>}
        {newMessages > 0 && <button className="new-messages" onClick={toLatest}>有 {newMessages} 条新消息 · 回到最新</button>}
        {requestState === 'unknown' && <p role="status">发送结果未知，请保留原内容安全重试。<button disabled={sending || busy || !healthy} onClick={() => void send(retryTarget ?? undefined)}>重试发送</button></p>}
        {requestState === 'failed' && <div role="status"><MessageStatus message={{ direction: 'user', status: 'failed' }} disabled={sending || busy || !healthy} onRetry={() => void send(retryTarget ?? undefined)} /></div>}
        {active && !healthy && wakePanel}
        <div className="composer-wrap">{stickerDrawer && stickerEntryVisible(stickers) && <StickerDrawer library={stickers} disabled={sending || busy || !healthy} close={() => setStickerDrawer(false)} send={(packId, asset) => void send(undefined, { packId, asset })} />}{attachments.length > 0 && <div className="attachment-tray">{attachments.map(image => <div key={image.id}><img src={image.dataUri} alt="待发送图片" /><button aria-label="移除图片" disabled={sending || busy} onClick={() => setAttachments(current => current.filter(item => item.id !== image.id))}>×</button></div>)}</div>}<form className="composer" onSubmit={event => { event.preventDefault(); if (!composing.current) void send() }}><button type="button" className="attach-button" aria-label="添加图片" disabled={busy || sending} aria-disabled={!!attachmentReason} aria-describedby="image-entry-hint" onClick={() => void pickImage()}>＋</button>{stickerEntryVisible(stickers) && <button type="button" className="sticker-entry" aria-label="打开表情包" aria-expanded={stickerDrawer} disabled={busy || sending} onClick={() => { composer.current?.blur(); setStickerDrawer(value => !value) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14q4 5 8 0M8 8v2M16 8v2" /></svg></button>}<textarea ref={composer} disabled={sending} rows={1} value={draft} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={event => { const action = composerEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode }, composing.current); if (action === 'send') { event.preventDefault(); void send() } }} onPaste={event => { const images = [...event.clipboardData.items].filter(item => item.type.startsWith('image/')).map(item => item.getAsFile()).filter((file): file is File => file !== null); if (images.length) { event.preventDefault(); void pickImage(images) } }} onChange={event => setDraft(event.target.value)} placeholder={runtime?.state === 'healthy' ? '写下你想说的话…' : '先写下来，唤醒后就能发送…'} maxLength={12000} aria-label="消息内容" /><button className="send" disabled={!native || runtime?.state !== 'healthy' || sending || busy || (!draft.trim() && !attachments.length)} aria-label="发送消息"><Icon name="arrow" /></button></form><p id="image-entry-hint" className="composer-hint">{attachmentReason || '最多 3 张图片 · 在空间中选择图片理解模型'}</p></div>
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
          <div className="inline-actions"><button onClick={toLatest}>回到最新</button><button onClick={() => act(async () => { await refreshStory() })}>刷新</button><button onClick={() => act(async () => { await bridge.rpc({ method: story?.story?.status === 'paused' ? 'story.resume' : 'story.pause' }); await refreshStory() }, '故事状态已更新。')}>{story?.story?.status === 'paused' ? '恢复故事' : '暂停故事'}</button></div>
          {detail === 'story' ? <div className="timeline">{story?.entries.filter(entry => entry.kind === 'script' || entry.kind === 'setup').map(entry => <article key={entry.id} data-read-anchor={`entry-${entry.id}`}><time>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</time><p>{entry.content}</p></article>)}{!story?.entries.some(entry => entry.kind === 'script') && <p className="quiet-empty">还没有生成生活剧本。对话后可在这里查看。</p>}</div> : detail === 'mind' ? <div className="mind-card"><span className="eyebrow">INNER WEATHER</span><h2>{active?.card.name || '角色'}的心绪</h2><p>{story?.story?.state?.alterSystem?.emotionalOffset?.description || '心绪还没有留下记录。随着故事继续，这里会记下细微的变化。'}</p></div> : <div className="timeline"><MemoryTools key={selected} cardId={selected} bridge={bridge} facts={story?.facts || []} intents={story?.intents || []} schedulingStatus={story?.schedulingStatus || []} paused={story?.story?.status === 'paused'} overlay={story?.overlay?.state || {}} busy={busy} act={act} refresh={refreshStory} />{story?.memories.map(memory => <article key={`memory-${memory.id}`} data-read-anchor={`memory-${memory.id}`}><span className="eyebrow">压缩记忆 #{memory.id}</span><p>{memory.summary || memory.content}</p></article>)}{!story?.facts.length && !story?.memories.length && <p className="quiet-empty">经历积累后，记忆会在这里出现。</p>}</div>}
        </>}
      </>}
      {page === 'settings' && <>
        <div className="page-heading"><div><div className="eyebrow">YOUR OWN LITTLE WORLD</div><h1>你的小小世界<span>。</span></h1><p>安放故事里的人，也安排这个世界的节奏。</p></div><span className="chapter">03 / 空间</span></div>
        <section><div className="section-title"><h2>故事的节奏</h2><span className="tag">{runtimeLabel}</span></div>{healthy ? <div className="actions"><button className="secondary" disabled={busy || sending} onClick={() => act(async () => { await bridge.stop(); setRuntime(await bridge.status()) }, '故事暂时歇息，经历都已留存。')}>让故事休息一下</button></div> : wakePanel}</section>
        <div className="save-status" role="status"><span>{native ? saveState : '界面预览 · 设置不会保存'}</span>{saveError && <><p className="error">{saveError}</p><button className="text-button" disabled={busy} onClick={() => void persistSettings().catch(() => {})}>重试保存</button></>}</div>
        <section className="settings-group settings-category" data-settings-category="personal"><details><summary><span><b>A 个性化</b><small>外观、陪伴节奏与消息提醒</small></span></summary>
          <button className="settings-entry" onClick={() => setPage('inbox')}><span>信箱 · QQ 与外部消息</span>{inboxUnread > 0 && <span className="letter-unread" aria-label={`${inboxUnread} 条未读`}>{inboxUnread}</span>}<Icon name="arrow" /></button>
          <p className="caption">外观 · {effectCaption('appearance')}；消息与提醒 · {effectCaption('notifications')}（需系统允许通知）。</p>
          <button className="settings-entry" onClick={() => setStickerManager(true)}><span>表情包<small>{stickers.packs.reduce((count, pack) => count + pack.stickers.length, 0)} 张 · 导入与管理</small></span><Icon name="arrow" /></button>
          <AppearanceSettings appearance={appearance} native={native} busy={busy} act={act} />
          <p className="caption">陪伴节奏 · {effectCaption('life')}，加载后影响后续回复与调度。</p>
          <LifeSettings value={settings.mobileConfig} change={mobileConfig => setSettings(previous => ({ ...previous, mobileConfig }))} bridge={bridge} healthy={healthy} native={native} notify={setNotice} />
          <NotificationSettings bridge={bridge} native={native} notify={setNotice} />
        </details></section>
        <section className="settings-group settings-category" data-settings-category="intelligence"><details><summary><span><b>B 智能</b><small>模型、故事身份与记忆</small></span></summary>
          <p className="caption">模型与识图 · {effectCaption('models')}。</p>
          <VoiceSettings bridge={bridge} state={voices.state} accept={voices.accept} cardId={selected} name={active?.card.name || ""} native={native} notify={setNotice} />
          <ModelCenter settings={settings} setSettings={setSettings} native={native} busy={busy || sending} bridge={bridge} act={act} notify={setNotice} />
          <section className="settings-group"><details><summary><span><b>故事与身份</b><small>你的称呼、人设与持续生活 · {effectCaption('identity')}</small></span></summary><label>你的称呼<input value={settings.userName} onChange={event => setSettings({ ...settings, userName: event.target.value })} maxLength={128} /></label><label>你的故事人设<textarea rows={3} value={settings.userProfile} onChange={event => setSettings({ ...settings, userProfile: event.target.value })} maxLength={12000} placeholder="你在这个世界中的身份、与角色的关系…" /></label><label className="toggle"><input type="checkbox" checked={settings.autoAdvance} onChange={event => setSettings({ ...settings, autoAdvance: event.target.checked })} /><div><b>持续生活与主动联系</b><p>默认关闭。开启后 HDS 可在通知服务存活时自动调用模型，产生 API 费用。</p></div></label><p className="caption">离开输入框时自动保存。这里的人设用于新故事，已有故事会保留原来的设定。</p></details></section>
          <button className="settings-entry" onClick={() => { setDetail('memory'); setPage('story') }}><span>记忆与故事<small>记忆维护完成后 · {effectCaption('memory')}</small></span><Icon name="arrow" /></button>
          <StoryManagement scope="story" bridge={bridge} cardId={selected} name={active?.card.name || ""} native={native} healthy={healthy} busy={busy || sending || transitioning} act={act} changed={storyChanged} notify={setNotice} />
        </details></section>
        <section className="settings-group settings-category" data-settings-category="data"><details><summary><span><b>C 数据</b><small>备份导出、恢复与核心诊断</small></span></summary>
          <StoryManagement scope="backup" bridge={bridge} cardId={selected} name={active?.card.name || ""} native={native} healthy={healthy} busy={busy || sending || transitioning} act={act} changed={storyChanged} notify={setNotice} />
          <section className="settings-group"><details><summary><span><b>核心维护与诊断</b><small>运行组件、设备信息与日志</small></span></summary><p className="caption">遇到运行问题时，可重新准备核心组件。角色与故事会保留。</p><button className="secondary" disabled={!native || busy || transitioning || healthy} onClick={() => act(async () => { await bridge.install(); setRuntime(await bridge.status()) })}>重新准备核心组件</button><h3>设备与诊断</h3><dl><div><dt>设备</dt><dd>{runtime?.device.model || '待原生读取'}</dd></div><div><dt>Android / API</dt><dd>{runtime ? `${runtime.device.android} / ${runtime.device.sdk}` : '—'}</dd></div><div><dt>ABI / 页大小</dt><dd>{runtime ? `${runtime.device.abi} / ${runtime.device.pageSize} B` : '—'}</dd></div><div><dt>表情包占用</dt><dd>{(libraryBytes(stickers) / 1024 ** 2).toFixed(2)} MiB（含已发送原件）</dd></div><div><dt>可用空间</dt><dd>{runtime ? `${(runtime.device.availableBytes / 1024 ** 3).toFixed(2)} GiB` : '—'}</dd></div><div><dt>应用 / HDS</dt><dd>{runtime?.version || '—'} / rc51</dd></div></dl><div className="actions"><button className="secondary" disabled={!native || busy} onClick={() => act(async () => setDiagnostic(await bridge.diagnostics({ probe: true })))}>查看安装诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(() => bridge.copyDiagnostics(), '安装诊断已复制，不含密钥、人设和聊天。')}>复制诊断</button><button className="secondary" disabled={!native || busy} onClick={() => act(async () => { const result = await bridge.saveDiagnostics(); setNotice(result.cancelled ? '已取消保存' : '安装诊断已保存。') })}>保存诊断</button></div>{diagnostic && <pre aria-label="安装诊断">{JSON.stringify(diagnostic, null, 2)}</pre>}<details><summary>查看运行日志</summary><pre role="log" aria-label="运行日志">{runtime?.logs.join('\n') || '暂无日志'}</pre></details><p className="caption">请反馈错误阶段、页大小与日志；分享前检查是否包含个人聊天内容。16 KB 页、后台存活与 QQ 能力均需真机验证。</p></details></section>
        </details></section>
      </>}
    </main>
    <nav ref={navigation} aria-label="主导航">{(['chat', 'story', 'settings'] as Page[]).map(key => <button key={key} className={key === page || (key === 'settings' && (page === 'cards' || page === 'inbox')) ? 'active' : ''} onClick={() => setPage(key)} aria-current={key === page || (key === 'settings' && (page === 'cards' || page === 'inbox')) ? 'page' : undefined}><Icon name={key} /><span>{labels[key]}</span></button>)}</nav>
    {stickerManager && <StickerManager library={stickers} bridge={bridge} native={native} change={saveStickers} close={() => setStickerManager(false)} notify={setNotice} />}
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
