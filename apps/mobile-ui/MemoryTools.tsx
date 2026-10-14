import React, { useEffect, useState } from 'react'
import type { NativeBridge } from '../../packages/contracts'

export type Fact = { id: number; content: string; scope?: string; importance?: number; confidence?: number; sourceEntryIds?: number[] }
type Props = { bridge: NativeBridge; facts: Fact[]; cardId: string; busy: boolean; act: (task: () => Promise<unknown>, success?: string) => Promise<void>; refresh: () => Promise<void> }
type Job = { status: 'running' | 'done' | 'failed'; result?: unknown; error?: string }
export function MemoryTools({ bridge, facts, cardId, busy, act, refresh }: Props) {
  const key = `hds-maintenance-${cardId}`
  const [jobId, setJobId] = useState(() => localStorage.getItem(key) || '')
  const [jobText, setJobText] = useState(''), [adding, setAdding] = useState(false), [target, setTarget] = useState<Fact | null>(null)
  const [content, setContent] = useState(''), [scope, setScope] = useState('event'), [sources, setSources] = useState<{ content: string; occurredAt: string }[] | null>(null)
  const [sourceFact, setSourceFact] = useState<Fact | null>(null)
  const start = async (kind: string, payload: Record<string, unknown> = {}) => {
    const requestId = crypto.randomUUID()
    // Persist before RPC: a timeout does not prove that the job never started.
    localStorage.setItem(key, requestId); setJobId(requestId); setJobText('正在提交维护任务…')
    await bridge.rpc({ method: 'maintenance.start', payload: { requestId, kind, ...payload } })
    setAdding(false); setTarget(null); setContent('')
  }
  useEffect(() => {
    if (!jobId) return
    let cancelled = false, polling = false
    const poll = async () => {
      if (polling) return; polling = true
      try {
        const result = await bridge.rpc({ method: 'maintenance.status', payload: { requestId: jobId } }); if (cancelled) return
        const job = result.data as Job
        if (job.status === 'running') setJobText('正在整理或修正记忆，请稍候…')
        else { localStorage.removeItem(key); setJobId(''); setJobText(job.status === 'failed' ? job.error || '维护失败' : job.result === false ? '当前没有可整理内容，或故事已暂停' : '记忆维护已完成'); await refresh() }
      } catch (error) { if (!cancelled) setJobText(`${String(error)}；任务编号已保留，可稍后查询`) } finally { polling = false }
    }
    void poll(); const timer = setInterval(() => void poll(), 2000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [jobId, cardId])
  return <>
    <div className="memory-actions"><button className="secondary" disabled={busy || !!jobId} onClick={() => setAdding(true)}>补充事实</button><button className="secondary" disabled={busy || !!jobId} onClick={() => act(() => start('compact'))}>立即整理记忆</button></div>
    <p className="caption">整理会调用模型，可能产生 API 费用；事实列表显示最近 30 条有效记录。</p>{jobText && <p className="notice" role="status">{jobText}{jobId && <button onClick={() => { if (window.confirm('停止查询不会取消服务器任务。确认清除本机查询记录？')) { localStorage.removeItem(key); setJobId('') } }}>停止查询</button>}</p>}
    <div className="timeline">{facts.map(fact => <article key={fact.id}><span className="eyebrow">长期事实 #{fact.id} · {fact.scope || '事实'}</span><p>{fact.content}</p><div className="fact-meta">{typeof fact.confidence === 'number' && <span>置信度 {Math.round(fact.confidence * 100)}%</span>}<button className="text-button" disabled={busy} onClick={() => act(async () => { const result = await bridge.rpc({ method: 'memory.factSources', payload: { id: fact.id } }); setSourceFact(fact); setSources(result.data as typeof sources) })}>查看来源</button><button className="text-button danger" disabled={busy || !!jobId} onClick={() => setTarget(fact)}>停用事实</button></div></article>)}</div>
    {adding && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="补充长期事实"><h2>补充长期事实</h2><label>事实类型<select value={scope} onChange={event => setScope(event.target.value)}><option value="event">事件</option><option value="character">人物</option><option value="world">世界</option><option value="relationship">关系</option><option value="promise">承诺</option></select></label><label>事实内容<textarea rows={4} value={content} maxLength={4000} onChange={event => setContent(event.target.value)} placeholder="写出具体人物和事实，避免只使用‘他’‘你’" /></label><div className="actions"><button onClick={() => setAdding(false)}>取消</button><button className="primary" disabled={busy || !content.trim()} onClick={() => act(() => start('fact-add', { scope, content }))}>保存事实</button></div></section></div>}
    {target && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="停用事实确认"><h2>停用事实 #{target.id}？</h2><p>{target.content}</p><p className="caption">这条事实将不再作为有效事实读取，记录保留供审计。原始聊天和摘要仍保留，角色可能从经历中再次想起此事。</p><div className="actions"><button onClick={() => setTarget(null)}>取消</button><button className="primary" disabled={busy} onClick={() => act(() => start('fact-forget', { id: target.id }))}>确认停用</button></div></section></div>}
    {sources && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="事实来源"><h2>事实 #{sourceFact?.id} 的来源</h2>{sources.map((entry, index) => <article key={index}><time>{new Date(entry.occurredAt).toLocaleString('zh-CN')}</time><p className="preview-text">{entry.content}</p></article>)}{!sources.length && <p>这条事实来自初始设定、人工补充，或没有保留可用来源。</p>}<button className="secondary" onClick={() => setSources(null)}>关闭来源</button></section></div>}
  </>
}
