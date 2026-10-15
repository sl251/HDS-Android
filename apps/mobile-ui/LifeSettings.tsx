import React, { useEffect, useRef, useState } from 'react'
import schema from '../../packages/contracts/mobile-config.schema.json'
import type { MobileConfig, NativeBridge } from '../../packages/contracts'

const names: Record<string, string> = { runtime: '固定节奏', urge: '弹性推进', agency: '主动联系', schedulePreplan: '日程预排', timelineDirector: '时间导演', chatActions: 'QQ 引用回复', alterSystem: '情绪变化', memory: '记忆整理' }
const choices: Record<string, string> = { low: '低频', medium: '中频', high: '高频', custom: '自定义（沿用中频）', strict: '严格', natural: '自然', balanced: '平衡', stable: '稳定规律', contextual: '阶段例外', granular: '少量变化' }
type Preview = { config: MobileConfig; code: string; title: string; revision: number; fingerprint: string; removed: string[]; changes: { section: string; field: string; before: unknown; after: unknown }[] }
type Budget = { limit: number; used: number; exhausted: boolean; resumesAt: number | null }
function NumericField({ value, array, min, max, step, change, label }: { value: unknown; array: boolean; min?: number; max?: number; step?: number; change: (value: unknown) => void; label: string }) {
  const format = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '')
  const [draft, setDraft] = useState(format(value))
  const [error, setError] = useState('')
  useEffect(() => { setDraft(format(value)); setError('') }, [JSON.stringify(value)])
  return <><input aria-label={label} type={array ? 'text' : 'number'} value={draft} min={min} max={max} step={step ?? 'any'} onChange={event => setDraft(event.target.value)} onBlur={() => {
    const values = array ? (draft.trim() ? draft.split(/[,，\s]+/).filter(Boolean).map(Number) : []) : [Number(draft)]
    if ((!array && !draft.trim()) || values.length > 12 || values.some(item => !Number.isFinite(item) || item < (min ?? -Infinity) || item > (max ?? Infinity) || ((array || step === 1) && !Number.isInteger(item)))) { setError('数值超出范围，尚未保存'); return }
    setError(''); change(array ? values : values[0])
  }} />{error && <small role="alert">{error}</small>}</>
}
export function LifeSettings({ value = {}, change, bridge, healthy, native, notify }: { value?: MobileConfig; change: (value: MobileConfig) => void; bridge: NativeBridge; healthy: boolean; native: boolean; notify: (text: string) => void }) {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [working, setWorking] = useState(false)
  const currentValue = useRef(value)
  currentValue.current = value
  useEffect(() => {
    if (!healthy || !native) { setBudget(null); return }
    let cancelled = false
    const poll = () => bridge.rpc({ method: 'config.status' }).then(result => { if (!cancelled) setBudget((result.data as { budget: Budget }).budget ?? null) }).catch(() => {})
    void poll(); const timer = setInterval(() => void poll(), 10000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [healthy, native])
  const update = (section: string, key: string, item: unknown) => change({ ...value, sections: { ...value.sections, [section]: { ...value.sections?.[section], [key]: item } } })
  const sync = async (apply: boolean) => {
    setWorking(true)
    const startedWith = JSON.stringify(value)
    try {
      const result = await bridge.rpc({ method: 'preset.sync', payload: { code, current: value, ...(apply && preview ? { fingerprint: preview.fingerprint } : {}) } })
      const next = result.data as Preview
      if (JSON.stringify(currentValue.current) !== startedWith) throw new Error('检查期间生活设置已修改，请重新检查；你的修改已保留。')
      if (apply) { change(next.config); setPreview(null); notify('预设已加入生活设置；自动保存后重启生效。') } else setPreview(next)
    } catch (error) { setPreview(null); notify(error instanceof Error ? error.message : '检查预设失败') }
    finally { setWorking(false) }
  }
  return <section className="settings-group"><details><summary><span><b>生活节奏与表达</b><small>她的日常、主动联系与后台预算</small></span></summary>
    <p className="caption">沿用电脑版默认值。弹性推进开启后接管固定补写；持续生活总开关控制自动生活；用户明确约定独立保留，但仍受暂停和预算约束。修改自动保存，重启后生效。</p>
    <label>24 小时后台模型请求上限<NumericField value={value.backgroundLimit ?? 120} array={false} min={0} max={10000} step={1} label="24 小时后台模型请求上限" change={item => change({ ...value, backgroundLimit: item as number })} /></label>
    <p className="caption">默认 120 次，0 为不限。滚动 24 小时统计，失败与重试也计数；重启不清零。直接聊天和手动整理不占后台额度。自动整理、识图等辅助请求也纳入预算。</p>
    {budget && <p role="status">已用 {budget.used} / {budget.limit || '不限'} 次{budget.exhausted ? ` · 后台额度已用完，最早 ${new Date(budget.resumesAt!).toLocaleString()} 恢复` : ''}</p>}
    {schema.sections.map(section => <details key={section.key}><summary>{names[section.key]}</summary>
      {section.fields.map(field => {
        const item = value.sections?.[section.key]?.[field.key] ?? field.default
        const f = field as typeof field & { min?: number; max?: number; step?: number; options?: string[]; itemMin?: number; itemMax?: number }
        const label = `${names[section.key]} · ${field.description}`
        return <label key={field.key} className={field.type === 'boolean' ? 'toggle' : ''}>
          {field.type === 'boolean' ? <><input type="checkbox" checked={item === true} onChange={event => update(section.key, field.key, event.target.checked)} /><span>{field.description}</span></>
          : <><span>{field.description}</span>{field.type === 'union' ? <select aria-label={label} value={String(item)} onChange={event => update(section.key, field.key, event.target.value)}>{f.options?.map(option => <option key={option} value={option}>{choices[option] ?? option}</option>)}</select>
          : <NumericField label={label} value={item} array={field.type === 'array'} min={f.min ?? f.itemMin} max={f.max ?? f.itemMax} step={f.step} change={next => update(section.key, field.key, next)} />}</>}
        </label>
      })}
      {section.key === 'runtime' && <p className="caption">承诺最长12小时。扫描是漏唤醒/恢复后的兜底，已有到期计时器无需等待扫描；不会唤醒被系统强制停止的应用。显式约定仍受预算与暂停约束。字段修改保存后重启生效。</p>}
      {section.key === 'chatActions' && <p className="caption">仅接通 QQ 引用回复；表情回应与原生表情尚未验证。</p>}
    </details>)}
    <details><summary>从分享码同步生活配置</summary><p className="caption">只同步这里支持的字段。模型连接、人设、总开关和预算保持你的设置。预设中的其他分区会列为忽略。</p>
      <label>typ0.space 分享码<input value={code} disabled={working} maxLength={24} onChange={event => { setCode(event.target.value); setPreview(null) }} /></label>
      <button disabled={!native || !healthy || working || !code.trim()} onClick={() => void sync(false)}>检查预设差异</button>
      {!healthy && <p className="caption">先唤醒故事，即可检查分享码。</p>}
      {preview && <div><h3>{preview.title} · 修订 {preview.revision}</h3><ul>{preview.changes.map(row => <li key={`${row.section}.${row.field}`}>{names[row.section]} · {row.field}：{JSON.stringify(row.before) ?? '默认'} → {JSON.stringify(row.after)}</li>)}</ul>{preview.removed.length > 0 && <p className="caption">已忽略：{preview.removed.join('、')}</p>}<button disabled={working} onClick={() => void sync(true)}>应用到生活设置</button></div>}
      <button disabled={!native || !healthy || working} onClick={async () => { try { const result = await bridge.rpc({ method: 'preset.syncStatus', payload: { current: value } }); notify((result.data as { restartRequired: boolean }).restartRequired ? '生活设置与当前运行配置不同，请保存并重启。' : '生活设置已在当前核心加载。') } catch (error) { notify(String(error)) } }}>检查重载状态</button>
    </details>
  </details></section>
}
