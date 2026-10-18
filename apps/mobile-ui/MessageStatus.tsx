import React from 'react'
import { messageStatusLabel, type Message } from '../../packages/contracts'

type StatusMessage = Pick<Message, 'direction' | 'status'> & Partial<Pick<Message, 'occurredAt'>>
export function MessageStatus({ message, lastCharacterReplyTs = 0, onRetry, disabled = false }: { message: StatusMessage; lastCharacterReplyTs?: number; onRetry?: () => void; disabled?: boolean }) {
  const label = messageStatusLabel(message, lastCharacterReplyTs)
  if (!label) return null
  if (message.status === 'card-opening') return <div className="message-opening">{label}</div>
  if (message.status === 'failed') return <button type="button" className="message-status message-retry" disabled={disabled} onClick={onRetry}>{label}</button>
  return <small className={`message-status${label === '已读' ? ' is-read' : ''}`}><span className="delivery-morph" aria-hidden="true"><svg className="delivery-checks" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 8 4 4L15 2M10 11l2 2L23 2" /></svg><svg className="read-checks" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m1 8 4 4L15 2M10 11l2 2L23 2" /></svg></span>{label}</small>
}

/** A submission in flight is not evidence that the character is typing. */
export function TypingBubble({ requestState }: { requestState: string }) {
  if (requestState !== 'sending') return null
  return <div className="message character-reply typing-message" role="status" aria-label="正在提交消息…"><div className="bubble"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>正在提交消息…</span></div></div>
}
