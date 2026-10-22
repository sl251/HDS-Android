import React, { useState } from 'react'
import type { DiagnosticMessageEvent } from '../../packages/contracts'
import { diagnosticLabels, diagnosticReasons } from '../../packages/contracts/diagnostics'
import { diagnosticAdvice, diagnosticConnection, diagnosticDuration, diagnosticReasonLabel, diagnosticTime, type DiagnosticMessage } from './message-diagnostics'

export function EventDetail({ event }: { event: DiagnosticMessageEvent }) {
  return <li data-outcome={event.outcome} data-event-id={event.id}>
    <div className="diagnostic-event-heading"><b>{diagnosticLabels[event.stage] ?? event.stage}</b><span>{diagnosticLabels[event.outcome] ?? event.outcome}</span></div>
    <small><time dateTime={new Date(event.at).toISOString()}>{diagnosticTime(event.at)}</time>{event.elapsedMs !== undefined && ` · ${diagnosticDuration(event.elapsedMs)}`}</small>
    {event.reason && <p>{diagnosticReasons[event.reason] ?? diagnosticReasonLabel(event.reason, event.stage)}<br />原因码：<code>{event.reason}</code></p>}
    {(event.providerSlot !== undefined || event.providerLabel) && <small>模型连接：{diagnosticConnection(event)}</small>}
    {event.providerSlot !== undefined && <small>调用时连接序号：{event.providerSlot}</small>}
    {event.attempt !== undefined && <small className={event.attempt >= 2 ? 'diagnostic-attempt' : undefined}>第 {event.attempt} 次尝试</small>}
    {event.willingness !== undefined && <small>本轮语音意愿：{event.willingness}</small>}
    {event.httpStatus !== undefined && <small>HTTP {event.httpStatus}</small>}
    {event.vectorDimensions !== undefined && <small>向量维度：{event.vectorDimensions}</small>}
    {event.resultCount !== undefined && <small>精排结果：{event.resultCount}</small>}
    {event.count !== undefined && <small>数量：{event.count}</small>}
    {event.entryId !== undefined && <small>故事记录编号：{event.entryId}</small>}
    {event.messageId && <small>已投递消息：<code>{event.messageId}</code></small>}
    {event.mode && <small>投递方式：{event.mode === 'voice' ? '语音' : event.mode === 'sticker' ? '表情' : event.mode === 'text' ? '文字' : event.mode}</small>}
    <small>关联消息：{event.requestIds.length ? event.requestIds.join('、') : '未记录'}</small>
    <small>事件编号：<code>{event.id}</code></small>
  </li>
}
export function DiagnosticMessageCard({ message, focused = false }: { message: DiagnosticMessage; focused?: boolean }) {
  const [expanded, setExpanded] = useState(focused)
  const [count, setCount] = useState(100)
  const current = message.steps[message.currentStep]
  const detailsId = `diagnostic-details-${encodeURIComponent(message.id)}`
  return <li className="diagnostic-message-card" data-diagnostic-message={message.id} data-focused={focused || undefined} data-failed={!!message.failure} tabIndex={-1} aria-label={`消息诊断：${message.preview}`}>
    {message.failure && <p className="diagnostic-advice"><b>怎么办：</b>{diagnosticAdvice(message.failure.reason)}</p>}
    <div className="diagnostic-card-heading"><b>{message.preview}</b><time dateTime={new Date(message.at).toISOString()}>{diagnosticTime(message.at)}</time></div>
    <p className="diagnostic-summary">{message.failure ? `本轮${current.name}失败 · ${diagnosticReasonLabel(message.failure.reason, message.failure.stage)}` : message.recovered ? '模型重试后已恢复，尝试记录可在下方查看。' : current.label === '未记录' ? '记录不完整，最终结果未确认。' : `${current.name} · ${current.label}`}</p>
    {message.events.some(event => ['embedding', 'rerank'].includes(event.stage)) && <p className="caption">检索增强：{message.events.some(event => event.outcome === 'fallback') ? '检索失败，已回退本地排序；聊天投递状态见下方。' : '检索已完成'}</p>}
    <ol className="diagnostic-pipeline" aria-label="消息处理步骤">{message.steps.map((step, index) => <li key={step.stage} data-stage={step.stage} data-state={step.state} aria-current={index === message.currentStep ? 'step' : undefined} aria-label={`第${index + 1}步：${step.name}，${step.label}`}>
      <span>{index + 1}. {step.name}{index < 5 && <span className="diagnostic-arrow" aria-hidden="true"> →</span>}</span><small>{step.state === 'failed' ? '失败 · ' : ''}{step.label}</small>
    </li>)}</ol>
    <button type="button" className="diagnostic-expand" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>{expanded ? '收起明细' : '展开明细'}（{message.events.length} 个事件）</button>
    {expanded && <div id={detailsId}>
      <p className="caption">全部事件按时间从早到晚排列。消息编号：{message.id}</p>
      <ol className="diagnostic-events">{message.events.slice(0, count).map(event => <EventDetail key={event.id} event={event} />)}</ol>
      {count < message.events.length && <button onClick={() => setCount(value => value + 100)}>显示更多明细（还有 {message.events.length - count} 个事件）</button>}
    </div>}
  </li>
}
