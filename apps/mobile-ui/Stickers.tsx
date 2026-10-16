import React, { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { NativeBridge } from '../../packages/contracts'
import { importIntoPack, recentStickers, sortedPacks, type StickerAsset, type StickerLibrary } from './sticker-state'

export const stickerSource = (asset: StickerAsset) => Capacitor.convertFileSrc(asset.path)
export function StickerDrawer({ library, disabled, send, close }: { library: StickerLibrary; disabled: boolean; send: (packId: string, asset: StickerAsset) => void; close: () => void }) {
  const recent = recentStickers(library)
  return <div className="sticker-drawer" role="region" aria-label="表情抽屉"><div className="section-title"><b>表情包</b><button type="button" aria-label="收起表情抽屉" onClick={close}>×</button></div><div className="sticker-groups">
    <div className="sticker-group"><h3>最近</h3>{!recent.length && <p className="caption">用过的表情会出现在这里</p>}<div className="sticker-grid">{recent.map(({ packId, sticker }) => <button type="button" key={sticker.id} disabled={disabled} onClick={() => send(packId, sticker)} aria-label="发送最近表情"><img loading="lazy" src={stickerSource(sticker)} alt="最近使用的表情" /></button>)}</div></div>
    {sortedPacks(library).filter(pack => pack.stickers.length).map(pack => <div className="sticker-group" key={pack.id}><h3>{pack.name}</h3><div className="sticker-grid">{pack.stickers.map(sticker => <button type="button" key={sticker.id} disabled={disabled} onClick={() => send(pack.id, sticker)} aria-label={`发送表情 · ${pack.name}`}><img loading="lazy" src={stickerSource(sticker)} alt={pack.name} /></button>)}</div></div>)}
  </div></div>
}

export function StickerManager({ library, bridge, native, change, close, notify }: { library: StickerLibrary; bridge: NativeBridge; native: boolean; change: (library: StickerLibrary) => void; close: () => void; notify: (text: string) => void }) {
  const [busy, setBusy] = useState(false), [name, setName] = useState(''), [target, setTarget] = useState(''), [deleting, setDeleting] = useState(''), [managing, setManaging] = useState(''), [feedback, setFeedback] = useState('')
  const [renaming, setRenaming] = useState(''), [rename, setRename] = useState('')
  const update = async (next: StickerLibrary) => {
    // Save metadata first: failed persistence must never delete files referenced by the old manifest.
    change(next)
    await bridge.pruneStickers({ keep: [...new Set([...next.packs.flatMap(pack => pack.stickers), ...Object.values(next.messages)].map(asset => asset.id))] })
  }
  const action = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); try { await task() } catch (error) { const text = error instanceof Error ? error.message : String(error); setFeedback(text); notify(text) } finally { setBusy(false) } }
  const importPack = (directory: boolean) => action(async () => {
    const result = await bridge.pickStickers({ directory })
    if (result.cancelled) return
    const imported = importIntoPack(library, target || crypto.randomUUID(), name || result.name || '我的表情', result.assets ?? [])
    if (imported.imported > 0) await update(imported.library)
    const text = `导入 ${imported.imported} 张，跳过 ${imported.skipped + (result.skipped ?? 0)} 张（重复或格式不支持）`
    setFeedback(text); notify(text)
  })
  return <div className="modal-backdrop"><section className="modal sticker-manager" role="dialog" aria-modal="true" aria-label="表情包管理"><div className="section-title"><h2>表情包</h2><button autoFocus disabled={busy} aria-label="关闭表情包管理" onClick={close}>×</button></div>
    <p className="caption">复制到应用内，原文件保留。支持 GIF、PNG、WebP、JPG；每张最大 10 MiB。</p>
    <label>导入到<select aria-label="导入到表情包" value={target} disabled={busy} onChange={event => setTarget(event.target.value)}><option value="">新建表情包</option>{library.packs.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>
    {!target && <label>新包名称<input value={name} disabled={busy} maxLength={80} onChange={event => setName(event.target.value)} placeholder="留空使用文件夹名称" /></label>}
    <div className="actions"><button className="secondary" disabled={!native || busy} onClick={() => void importPack(false)}>多选图片导入</button><button className="secondary" disabled={!native || busy} onClick={() => void importPack(true)}>整文件夹导入</button></div>
    {busy && <p role="status">正在处理表情包…</p>}{feedback && <p role="status">{feedback}</p>}
    {!library.packs.length && <p className="quiet-empty">导入一包表情，就能在聊天里使用。</p>}
    {sortedPacks(library).map(pack => <div className="sticker-group" key={pack.id}><h3>{pack.name} · {pack.stickers.length} 张</h3><div className="actions"><button disabled={busy} onClick={() => { setRenaming(pack.id); setRename(pack.name) }}>重命名</button><button disabled={busy} onClick={() => setManaging(managing === pack.id ? '' : pack.id)}>{managing === pack.id ? '完成管理' : '管理贴纸'}</button><button className="danger" disabled={busy} onClick={() => setDeleting(pack.id)}>删除包</button></div>
      {renaming === pack.id && <form onSubmit={event => { event.preventDefault(); void action(async () => { await update({ ...library, packs: library.packs.map(item => item.id === pack.id ? { ...item, name: rename.trim() } : item) }); setRenaming('') }) }}><label>表情包名称<input aria-label="表情包名称" value={rename} maxLength={80} disabled={busy} onChange={event => setRename(event.target.value)} /></label><button disabled={busy || !rename.trim()} className="secondary">保存包名</button></form>}
      {deleting === pack.id && <div role="alertdialog" aria-label="删除表情包确认"><p>删除「{pack.name}」？已发送的贴纸仍保留。</p><div className="actions"><button disabled={busy} onClick={() => setDeleting('')}>取消</button><button className="danger" disabled={busy} onClick={() => void action(async () => { await update({ ...library, packs: library.packs.filter(item => item.id !== pack.id) }); setDeleting(''); if (target === pack.id) setTarget('') })}>确认删除表情包</button></div></div>}
      <div className="sticker-grid">{pack.stickers.map(sticker => <div key={sticker.id}><img loading="lazy" src={stickerSource(sticker)} alt={pack.name} />{managing === pack.id && <button className="danger" disabled={busy} aria-label="删除单个贴纸" onClick={() => void action(() => update({ ...library, packs: library.packs.map(item => item.id === pack.id ? { ...item, stickers: item.stickers.filter(s => s.id !== sticker.id) } : item) }))}>删除</button>}</div>)}</div>
    </div>)}
  </section></div>
}
