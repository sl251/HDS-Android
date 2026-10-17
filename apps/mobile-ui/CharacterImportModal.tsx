import React, { useRef, useState } from 'react'
import { inspectSharedCharacter, type CharacterImport, type SharedCharacter } from './character-import'

export function CharacterImportModal({ busy, working, save, close }: { busy: boolean; working: (value: boolean) => void; save: (input: CharacterImport) => Promise<void>; close: () => void }) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<SharedCharacter | null>(null)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const inspect = async (commit: boolean) => {
    if (busy || lock.current || !code.trim() || (commit && !preview)) return
    lock.current = true; working(true); setError('')
    try {
      const next = await inspectSharedCharacter(code, commit ? preview!.fingerprint : undefined)
      if (commit) { await save(next); close() }
      else setPreview(next)
    } catch (failure) { setPreview(null); setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { lock.current = false; working(false) }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="用分享码导入角色" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) close() } }}>
    <div className="section-title"><h2>用分享码导入角色</h2><button autoFocus aria-label="关闭导入码" disabled={busy} onClick={close}>×</button></div>
    <p className="caption">导入到角色库，不覆盖当前故事。无需先选角色、配置模型或唤醒故事。已有相同角色卡会复用，保留其编辑与历史。</p>
    <label>typ0.space 导入码<input value={code} disabled={busy} maxLength={64} placeholder="8 位分享码，可带空格或连字符" onChange={event => { setCode(event.target.value); setPreview(null); setError('') }} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="secondary" disabled={busy || !code.trim()} onClick={() => void inspect(false)}>检查</button>
    {preview && <div><h3>{preview.title} · 修订 {preview.revision}</h3><h3>{preview.card.name}</h3><p className="preview-text">{preview.card.description}</p><ul>{preview.card.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      <p className="caption">只导入角色人设。生活配置、模型连接与 QQ 设置不会自动更改。</p>
      <button className="primary wide" disabled={busy} onClick={() => void inspect(true)}>导入角色卡</button>
    </div>}
  </section></div>
}
