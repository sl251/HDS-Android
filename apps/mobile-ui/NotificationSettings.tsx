import React, { useEffect, useState } from 'react'
import type { MessageNotificationSettings, NativeBridge } from '../../packages/contracts'

export function NotificationSettings({ bridge, native, notify }: { bridge: NativeBridge; native: boolean; notify: (message: string) => void }) {
  const [value, setValue] = useState<MessageNotificationSettings>({ enabled: false, permission: 'prompt', available: false })
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!native) return
    let disposed = false
    const refresh = () => { void bridge.notificationSettings().then(next => { if (!disposed) { setValue(next); setReady(true) } }).catch(error => { if (!disposed) notify(String(error)) }) }
    refresh()
    window.addEventListener('focus', refresh)
    const visible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { disposed = true; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [bridge, native])
  const blocked = value.permission === 'denied' || (value.enabled && !value.available)
  const change = async (enabled: boolean) => {
    setBusy(true)
    try { setValue(await bridge.setMessageNotifications({ enabled })) }
    catch (error) { notify(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <section className="settings-group"><details><summary><span><b>消息与提醒</b><small>后台通知与夜间安静</small></span></summary>
    <label className="toggle"><input type="checkbox" aria-label="角色消息通知" checked={value.enabled} disabled={!native || !ready || busy} onChange={event => void change(event.target.checked)} /><div><b>角色消息通知</b><p>离开应用时，提醒你角色的新消息。23:00–08:00 只显示通知，不响铃或振动。</p></div></label>
    <p className="caption" role="status">{!native ? '界面预览 · 请在 Android 应用中设置' : blocked ? '系统通知权限或角色消息渠道未开启' : value.enabled && value.available ? '已开启 · 前台阅读时不提醒' : '默认关闭 · 开启时申请系统通知权限'}</p>
    {native && blocked && <button className="text-button" onClick={() => void bridge.openNotificationSettings().catch(error => notify(String(error)))}>去系统设置</button>}
  </details></section>
}
