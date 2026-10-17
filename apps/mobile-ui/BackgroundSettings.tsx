import React, { useEffect, useState } from 'react'
import type { BackgroundState, NativeBridge } from '../../packages/contracts'
export function BackgroundSettings({ bridge, native, notify }: { bridge: NativeBridge; native: boolean; notify: (value: string) => void }) {
  const [state, setState] = useState<BackgroundState>()
  useEffect(() => { if (!native) return; let alive = true; const read = () => bridge.backgroundState().then(value => { if (alive) setState(value) }).catch(() => {}); void read(); const timer = setInterval(() => void read(), 5000); return () => { alive = false; clearInterval(timer) } }, [native, bridge])
  return <section className="settings-group"><details><summary><b>后台持续在线</b></summary>
    <label className="toggle"><input type="checkbox" disabled={!native || !state} checked={state?.enabled ?? false} onChange={async e => { try { setState(await bridge.saveBackgroundPolicy({ enabled: e.target.checked })) } catch (error) { notify(String(error)) } }} /><div><b>允许异常退出后恢复</b><p>由你启动后，在系统允许时恢复原角色及已开启的 QQ；连续失败最多重试 3 次。停止全部后不会恢复。</p></div></label>
    <p className="caption">通知：{state ? state.notificationAllowed ? '已允许' : '尚未允许' : '无法自动检测'} · 电池优化：{state ? state.batteryUnrestricted ? '已豁免' : '尚未豁免' : '无法自动检测'} · 网络：{state?.networkType ?? '待检测'}{state?.doze ? ' · 系统休眠中' : ''}</p>
    <div className="actions"><button disabled={!native} onClick={() => void bridge.openNotificationSettings().catch(e => notify(String(e)))}>通知设置</button><button disabled={!native} onClick={() => void bridge.openBatterySettings().catch(e => notify(String(e)))}>电池优化设置</button></div>
    <p className="caption">厂商自启动与后台限制需在系统中检查，无法自动检测。升级后请手动唤醒一次；系统强停后需你重新打开应用。</p>
  </details></section>
}
