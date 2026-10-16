import React, { useState } from 'react'
import { splitThinking } from './composer-state'

/** Remove unsupported media labels only; keep ordinary bracketed prose intact. */
export const stripMediaMarkers = (text: string) => text.replace(/(?:\[|【)\s*(?:表情包?|贴纸|贴图|图片|图像|动图|gif|sticker|image|media|localMedia)(?:\s*[:：][^\]】\n]*|\s+[^\]】\n]*)?\s*(?:\]|】)/gi, '')

export function MessageContent({ message }: { message: { content: string; reasoning_content?: string } }) {
  const [open, setOpen] = useState(false)
  const { content, thought } = splitThinking(message)
  return <>{thought && <div className="thinking"><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>思考 · 耗时未提供 · 点击{open ? '收起' : '展开'}</button>{open && <div className="thinking-content">{thought}</div>}</div>}{stripMediaMarkers(content)}</>
}
