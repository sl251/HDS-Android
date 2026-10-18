import React, { useEffect, useRef, useState } from 'react'
import type { NativeBridge } from '../../packages/contracts'
import { diagnosticLabels, diagnosticReasons, type DiagnosticEvent } from '../../packages/contracts/diagnostics'
import { voiceResultLabel } from '../../packages/contracts/voice'

export function MessageDiagnostics({ bridge, healthy, messageId, close }: { bridge: NativeBridge; healthy: boolean; messageId: string; close: () => void }) {
  const [events, setEvents] = useState<DiagnosticEvent[]>([])
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(messageId), [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [visibleCount, setVisibleCount] = useState(100)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; closeButton.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  useEffect(() => {
    let alive = true, running = false
    if (!healthy) { setLoading(false); return }
    const read = async () => {
      if (running) return
      running = true
      try {
        const result = await bridge.rpc({ method: 'diagnostics.messages', payload: filter ? { messageId: filter } : {} })
        if (alive) { const data = result.data as { events: DiagnosticEvent[]; storageAvailable: boolean }; setEvents(data.events); setError(data.storageAvailable ? '' : '诊断暂未写入磁盘，当前显示内存记录。') }
      } catch { if (alive) setError('无法读取记录，请确认当前故事核心正在运行。') }
      finally { running = false; if (alive) setLoading(false) }
    }
    setLoading(true); setEvents([]); setVisibleCount(100); void read()
    const timer = setInterval(() => void read(), 3000)
    return () => { alive = false; clearInterval(timer) }
  }, [bridge, healthy, filter, revision])
  const exportEvents = async () => {
    setBusy(true)
    try { await bridge.saveMessageDiagnostics({ ...(filter ? { messageId: filter } : {}) }) }
    catch { setError('诊断导出失败，请重新尝试。') } finally { setBusy(false) }
  }
  const ids = [...new Set(events.flatMap(event => event.requestIds))].reverse()
  return <div className="modal-backdrop"><section className="modal message-diagnostics" role="dialog" aria-modal="true" aria-label="消息诊断" onKeyDown={event => {
    if (event.key === 'Escape') close()
    if (event.key === 'Tab') {
      const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)')]
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    <div className="section-title"><h2>消息诊断</h2><button ref={closeButton} onClick={close} aria-label="关闭消息诊断">×</button></div>
    <p className="caption">当前故事的实际运行记录。仅本机保存最近 7 天，最多 2000 个事件、1 MiB；不保存正文、人设、密钥或音频，也不额外调用模型。</p>
    <p className="caption">“不回复”来自核心实际回复决策；“稍后回复”不等于已送达。没有记录或结果未知时，不推测原因。旧消息无法补录，后续独立回合不按时间猜测关联。</p>
    {!healthy && <p role="status">先唤醒当前故事，再查看诊断。</p>}
    <label>查看范围<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">全部记录</option>{[...new Set([filter, ...ids])].filter(Boolean).map(id => <option value={id} key={id}>消息 {id.slice(0, 8)}</option>)}</select></label>
    <div className="actions"><button disabled={!healthy || busy || !events.length} onClick={() => void exportEvents()}>导出脱敏记录</button><button disabled={!healthy || busy} onClick={() => setConfirmClear(true)}>清空本故事记录</button></div>
    {confirmClear && <div role="alert"><p>清空诊断不会删除聊天。后续新回合仍会产生诊断记录。</p><button disabled={busy} onClick={() => { setBusy(true); void bridge.rpc({ method: 'diagnostics.clear' }).then(() => { setEvents([]); setRevision(value => value + 1); setConfirmClear(false) }).catch(() => setError('清空失败，请重试。')).finally(() => setBusy(false)) }}>确认清空</button><button onClick={() => setConfirmClear(false)}>取消</button></div>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">读取中…</p> : !events.length && <p className="quiet-empty">这个范围没有保留的记录。</p>}
    <ol className="diagnostic-events">{events.slice(-visibleCount).reverse().map(event => <li key={event.id} data-outcome={event.outcome}>
      <div><b>{diagnosticLabels[event.stage] ?? event.stage}</b><span>{diagnosticLabels[event.outcome] ?? event.outcome}</span></div>
      <small>{new Date(event.at).toLocaleString()} · {event.requestIds.map(id => id.slice(0, 8)).join('、')}{event.elapsedMs !== undefined && ` · ${event.elapsedMs} ms`}</small>
      {event.reason && <p>{diagnosticReasons[event.reason] ?? (event.stage === 'voice' ? voiceResultLabel({ reason: event.reason, stage: event.stage }) : `原因码：${event.reason}`)}</p>}
      {event.willingness !== undefined && <small>本轮语音意愿：{event.willingness}</small>}
      {!!event.providerSlot && <small>本轮模型连接序号：{event.providerSlot}（对应调用时的连接顺序）</small>}
      {event.count !== undefined && <small>数量：{event.count}</small>}
      {event.messageId && <small>已投递消息：{event.messageId.slice(0, 8)} · {event.mode === 'voice' ? '语音' : event.mode === 'sticker' ? '表情' : '文字'}</small>}
    </li>)}</ol>
    {events.length > visibleCount && <button onClick={() => setVisibleCount(value => value + 100)}>显示更早记录（还有 {events.length - visibleCount} 条）</button>}
  </section></div>
}
