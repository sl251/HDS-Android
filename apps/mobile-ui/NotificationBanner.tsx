import React, { useEffect, useRef, useState } from 'react'
import type { Message, MessageNotificationSettings, NativeBridge } from '../../packages/contracts'

export function NotificationBanner({ bridge, native, cardId, messages, reading, name, open }: { bridge: NativeBridge; native: boolean; cardId: string; messages: Message[]; reading: boolean; name: string; open: () => void }) {
  const [settings, setSettings] = useState<MessageNotificationSettings>(), [message, setMessage] = useState<Message>()
  const known = useRef<{ cardId: string; ids: Set<string> }>({ cardId: '', ids: new Set() })
  useEffect(() => { if (!native) return; const read = () => { void bridge.notificationSettings().then(setSettings).catch(() => {}) }; read(); window.addEventListener('hds-notifications-changed', read); return () => window.removeEventListener('hds-notifications-changed', read) }, [native, bridge])
  useEffect(() => {
    const rows = messages.filter(m => m.direction === 'character' && m.status !== 'card-opening')
    if (known.current.cardId === cardId && settings?.enabled && settings.foreground && !reading && !document.hidden) {
      const recent = rows.filter(row => !known.current.ids.has(row.id) && Date.now() - Date.parse(row.occurredAt) < 15000).at(-1)
      if (recent) setMessage(recent)
    }
    known.current = { cardId, ids: new Set(rows.map(row => row.id)) }
    if (reading) setMessage(undefined)
  }, [messages, cardId, reading, settings])
  useEffect(() => { setMessage(undefined) }, [cardId])
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(undefined), 6000); return () => clearTimeout(timer) }, [message])
  return message ? <aside className="notification-banner" role="status"><button onClick={() => { setMessage(undefined); open() }}><strong>{name}</strong><span>{settings?.preview === false ? '你收到了一条新消息' : message.content.slice(0, 80) || '收到一张图片'}</span></button><button onClick={() => setMessage(undefined)} aria-label="关闭消息提醒">×</button></aside> : null
}
