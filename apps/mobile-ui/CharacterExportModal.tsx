import React, { useRef, useState } from 'react'
import type { MobileConfig, NativeBridge } from '../../packages/contracts'
import { createCharacterExport, saveCharacterExport, type CharacterExport, type ExportFormat } from './character-export'

const formats: { value: ExportFormat; label: string; caption: string }[] = [
  { value: 'tavern', label: 'SillyTavern V2 角色卡', caption: 'JSON 角色卡，可直接导入酒馆' },
  { value: 'preset', label: 'HDSI 预设 JSON', caption: '人设与生活配置，可上传 typ0.space' },
  { value: 'yaml', label: 'YAML 视图', caption: '同一预设的人类可读版本，便于分享' },
]
export function CharacterExportModal({ bridge, native, ready, name, config, revision, busy, working, close }: { bridge: NativeBridge; native: boolean; ready: boolean; name: string; config?: MobileConfig; revision: () => string; busy: boolean; working: (value: boolean) => void; close: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('tavern')
  const [file, setFile] = useState<CharacterExport | null>(null)
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const lock = useRef(false)
  const content = useRef<HTMLTextAreaElement>(null)
  const current = useRef({ config, revision })
  current.current = { config, revision }
  const exportFile = async () => {
    if (lock.current || busy || !ready) return
    lock.current = true; working(true); setError(''); setPath(''); setFile(null); setCopied(false)
    const started = revision(), settings = JSON.stringify(config ?? {})
    try {
      const snapshot = (await bridge.rpc({ method: 'story.snapshot' })).data as { story?: { setting?: unknown } } | null
      if (current.current.revision() !== started || JSON.stringify(current.current.config ?? {}) !== settings) throw new Error('导出期间角色或生活设置已变化，请重新导出。')
      const next = createCharacterExport(format, snapshot?.story?.setting, JSON.parse(settings))
      setFile(next)
      setPath(await saveCharacterExport(next, native))
    } catch (error) { setError(error instanceof Error ? error.message : '导出失败，请重试。') }
    finally { lock.current = false; working(false) }
  }
  const copy = async () => {
    if (!file) return
    setError(''); setCopied(false)
    try {
      try { await navigator.clipboard.writeText(file.content) }
      catch { content.current?.focus(); content.current?.select(); if (!document.execCommand('copy')) throw new Error('复制失败，请长按下方内容手动复制。') }
      setCopied(true)
    } catch (error) { setError(error instanceof Error ? error.message : '复制失败，请长按下方内容手动复制。') }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="导出角色" aria-describedby="export-caption" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) close() } }}><div className="section-title"><h2>导出角色</h2><button autoFocus aria-label="关闭导出" disabled={busy} onClick={close}>×</button></div>
    <p id="export-caption" className="caption">当前故事：{name || '尚未选择'}。导出当前保存的人设；预设同时包含生活配置白名单分区，连接字段与结构化联系方式已剔除。</p>
    <fieldset disabled={busy} aria-label="导出格式">{formats.map(item => <label className="toggle" key={item.value}><input type="radio" name="character-export-format" value={item.value} checked={format === item.value} onChange={() => { setFormat(item.value); setFile(null); setPath(''); setError(''); setCopied(false) }} /><span><b>{item.label}</b><small className="caption">{item.caption}</small></span></label>)}</fieldset>
    {!ready && <p className="caption">请先选择角色并唤醒故事，再导出当前人设。</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary wide" disabled={busy || !ready} onClick={() => void exportFile()}>{busy ? '正在导出…' : '导出'}</button>
    {file && <><p className="caption" role="status">{path || '内容已生成，尚未保存文件。'}{copied && ' 内容已复制。'}</p>{native && path && <p className="caption">文件保存在 App 私有目录，同名导出会覆盖；可复制内容到其他应用另存或分享。</p>}<button className="secondary wide" disabled={busy} onClick={() => void copy()}>复制内容</button><label>导出内容<textarea aria-label="导出内容" ref={content} readOnly rows={8} value={file.content} /></label></>}
  </section></div>
}
