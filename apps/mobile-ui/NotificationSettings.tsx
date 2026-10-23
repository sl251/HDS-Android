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
  const change = async (patch: Partial<MessageNotificationSettings>) => {
    setBusy(true)
    try { setValue(await bridge.setMessageNotifications({ ...value, ...patch })); window.dispatchEvent(new Event('hds-notifications-changed')) }
    catch (error) { notify(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <section className="settings-group"><details open><summary><span><b>消息与提醒</b><small>后台通知与夜间安静</small></span></summary>
    <label className="toggle"><input type="checkbox" aria-label="角色消息通知" checked={value.enabled} disabled={!native || !ready || busy} onChange={event => void change({ enabled: event.target.checked })} /><div><b>角色消息通知</b><p>选择你习惯的提醒形式，点击通知回到对应故事。</p></div></label>
    <fieldset disabled={!native || !ready || busy} style={{ border: 0, padding: 0 }}>
      <label>后台提醒形式<select value={value.mode ?? 'popup'} onChange={e => void change({ mode: e.target.value as MessageNotificationSettings['mode'] })}><option value="popup">悬浮弹窗与通知栏</option><option value="normal">仅通知栏</option><option value="silent">静默通知</option></select></label>
      <label className="toggle"><input type="checkbox" checked={value.foreground ?? false} onChange={e => void change({ foreground: e.target.checked })} />在应用其他页面显示消息横幅</label>
      <label className="toggle"><input type="checkbox" checked={value.preview ?? true} onChange={e => void change({ preview: e.target.checked })} />显示消息内容预览</label>
      <label className="toggle"><input type="checkbox" checked={value.quietEnabled ?? true} onChange={e => void change({ quietEnabled: e.target.checked })} />安静时段 · 不响铃或振动</label>
      <div className="actions"><label>开始（时）<input type="number" min={0} max={23} value={value.quietStart ?? 23} onChange={e => void change({ quietStart: Number(e.target.value) })} /></label><label>结束（时）<input type="number" min={0} max={23} value={value.quietEnd ?? 8} onChange={e => void change({ quietEnd: Number(e.target.value) })} /></label></div>
      <p className="caption">悬浮提醒、声音和振动还受系统通知渠道控制；开始和结束相同表示全天安静。</p>
      <button className="text-button" onClick={() => void bridge.openNotificationSettings().catch(e => notify(String(e)))}>调整系统声音、振动与悬浮权限</button>
    </fieldset>
    <p className="caption" role="status">{!native ? '界面预览 · 请在 Android 应用中设置' : blocked ? '系统通知权限或角色消息渠道未开启' : value.enabled && value.available ? '已开启 · 前台阅读时不提醒' : '默认关闭 · 开启时申请系统通知权限'}</p>
  </details></section>
}
