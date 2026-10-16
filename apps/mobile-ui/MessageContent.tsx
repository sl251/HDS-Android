import React, { useState } from 'react'
import { splitThinking } from './composer-state'

import { stripMediaMarkers } from '../../packages/contracts/voice'
export { stripMediaMarkers } from '../../packages/contracts/voice'

export function MessageContent({ message }: { message: { content: string; reasoning_content?: string } }) {
  const [open, setOpen] = useState(false)
  const { content, thought } = splitThinking(message)
  return <>{thought && <div className="thinking"><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>思考 · 耗时未提供 · 点击{open ? '收起' : '展开'}</button>{open && <div className="thinking-content">{thought}</div>}</div>}{stripMediaMarkers(content)}</>
}
