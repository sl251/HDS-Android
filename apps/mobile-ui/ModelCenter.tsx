import React, { useEffect, useState } from 'react'
import type { ModelOptions, ModelProvider, ModelSettings, NativeBridge } from '../../packages/contracts'
import { assigned, assignTask, followsMain, removeProvider } from './model-tasks'
import presets from '../../android/app/src/main/assets/model-presets.json'

export const defaultOptions: ModelOptions = { mainStreamingMode: 'off', mainResponseFormat: 'json-object', mainTemperature: 0.8, mainMaxTokens: 4096, mainTimeout: 60000, mainPayloadOrder: 'cache-first', failoverEnabled: false, failoverStrategy: 'priority' }
export const newProvider = (): ModelProvider => ({ id: crypto.randomUUID(), preset: 'custom', label: '自定义连接', endpoint: '', model: '', protocol: 'chat-completions', enabled: true, credentialPresent: false, useForMain: true, useForCompaction: true, useForAlter: true, deepseekThinking: 'inherit' })
const roles = [{ key: 'useForMain', name: '主叙事', description: '对话、生活剧本与主动联系' }, { key: 'useForCompaction', name: '记忆压缩', description: '场景整理、长期记忆与时间导演' }, { key: 'useForAlter', name: '心理分析', description: '事件带来的情绪与氛围变化' }] as const
type Props = { settings: ModelSettings; setSettings: React.Dispatch<React.SetStateAction<ModelSettings>>; native: boolean; busy: boolean; bridge: NativeBridge; act: (task: () => Promise<unknown>, success?: string) => Promise<void>; notify: (text: string) => void }

export function ModelCenter({ settings, setSettings, native, busy, bridge, act, notify }: Props) {
  const [selected, setSelected] = useState(settings.providers[0]?.id ?? '')
  const [catalogs, setCatalogs] = useState<Record<string, { models: string[]; partial: boolean }>>({})
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const providers = settings.providers
  useEffect(() => { if (!providers.some(row => row.id === selected)) setSelected(providers[0]?.id ?? '') }, [providers, selected])
  const row = providers.find(value => value.id === selected) ?? providers[0]
  const update = (patch: Partial<ModelProvider>) => {
    if (!row) return
    setSettings(current => ({ ...current, providers: current.providers.map(value => value.id === row.id ? { ...value, ...patch } : value) }))
    if (['endpoint', 'apiKey', 'preset', 'protocol', 'modelsEndpoint', 'clearKey'].some(key => key in patch)) setCatalogs(current => { const next = { ...current }; delete next[row.id]; return next })
  }
  const option = (patch: Partial<ModelOptions>) => setSettings(current => ({ ...current, modelOptions: { ...current.modelOptions, ...patch } }))
  const reorder = (delta: number) => {
    const index = providers.findIndex(value => value.id === row?.id)
    if (index + delta < 0 || index + delta >= providers.length) return
    const next = [...providers]; [next[index], next[index + delta]] = [next[index + delta], next[index]]
    setSettings({ ...settings, providers: next })
  }
  const choosePreset = (id: string) => {
    const preset = presets.find(item => item.id === id)!
    update({ preset: id, label: preset.label, endpoint: preset.endpoint, model: preset.model, protocol: preset.protocol as ModelProvider['protocol'], apiKey: '', clearKey: true, credentialPresent: false, modelsEndpoint: '', deepseekThinking: id === 'deepseek' ? 'disabled' : 'inherit' })
    setSearch('')
  }
  const catalog = row && catalogs[row.id]
  const filtered = catalog?.models.filter(model => model.toLowerCase().includes(search.toLowerCase())) ?? []
  return <section className="model-center">
    <details className="settings-group"><summary><span><b>模型与识图</b><small>{providers.length} 条连接 · 任务分工与生成参数</small></span></summary>
    <p className="caption">每条连接只填一次。把擅长写作的模型交给主叙事，把轻量模型交给记忆与情绪。</p>
    <details><summary>任务分工</summary>
    <div className="model-roles">{roles.map((role, index) => {
      const ids = assigned(providers, role.key)
      const inherit = role.key !== 'useForMain' && followsMain(providers, role.key)
      const value = inherit ? 'inherit' : ids.length === 1 ? ids[0] : 'custom'
      return <label className="task-card" key={role.key}><span className="task-number">0{index + 1}</span><b>{role.name}</b><span>{role.description}</span><select aria-label={`${role.name}模型`} disabled={busy} value={value} onChange={event => setSettings(current => ({ ...current, providers: assignTask(current.providers, role.key, event.target.value) }))}>
        {role.key !== 'useForMain' && <option value="inherit">自动沿用主叙事</option>}
        <option value="custom" disabled>{ids.length > 1 ? '多模型 · 自定义分工' : '请选择模型连接'}</option>
        {providers.filter(provider => provider.enabled).map(provider => <option key={provider.id} value={provider.id}>{provider.model || provider.label} · {provider.label}</option>)}
      </select></label>
    })}</div></details>
    <details><summary>管理模型连接 · {providers.length} 条</summary>
    <div className="provider-tabs" aria-label="模型连接">{providers.map((provider, index) => <button key={provider.id} disabled={busy} className={row?.id === provider.id ? 'active' : ''} aria-pressed={row?.id === provider.id} onClick={() => { setSelected(provider.id); setSearch(''); setEditorOpen(true) }}><small>{String(index + 1).padStart(2, '0')}</small>{provider.label || '未命名'}{!provider.enabled && <span>已停用</span>}</button>)}<button className="add-provider" disabled={busy || providers.length >= 12} onClick={() => { const provider = { ...newProvider(), ...(providers.length ? { useForMain: false, useForCompaction: false, useForAlter: false } : {}) }; setSettings({ ...settings, providers: [...providers, provider] }); setSelected(provider.id); setEditorOpen(true) }}>＋ 添加连接</button></div>
    {row && <details open={editorOpen} onToggle={event => setEditorOpen(event.currentTarget.open)}><summary><span><b>{row.label || '未命名连接'}</b><small>{row.model || '尚未选择模型'} · {row.credentialPresent ? '密钥已保存' : '待配置密钥'}</small></span></summary><fieldset disabled={busy} className="provider-editor">
      <div className="section-title"><b>{row.label || '未命名连接'}</b><button className="text-button danger" onClick={() => { setSettings(current => ({ ...current, providers: removeProvider(current.providers, row.id) })); setCatalogs(current => { const next = { ...current }; delete next[row.id]; return next }); notify('连接已移除，模型分工已调整。') }}>删除此连接</button></div>
      <div className="field-pair"><label>连接名称<input value={row.label} maxLength={256} onChange={event => update({ label: event.target.value })} /></label><label>供应商预设<select value={row.preset} onChange={event => choosePreset(event.target.value)}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label></div>
      <label>API 地址<input type="url" value={row.endpoint} readOnly={row.preset !== 'custom'} onChange={event => update({ endpoint: event.target.value })} placeholder="https://…/v1" autoCapitalize="none" spellCheck={false} /></label>
      <p className="caption">支持 Base URL 或完整接口。预设地址由原 HDS 提供；中转站、百炼其他地域请选“自定义”。</p>
      {row.preset === 'custom' && <label>接口协议<select value={row.protocol} onChange={event => update({ protocol: event.target.value as ModelProvider['protocol'] })}><option value="chat-completions">OpenAI Chat Completions</option><option value="anthropic-messages">Anthropic Messages</option></select></label>}
      <label>API Key <span className="caption">{row.clearKey ? '原密钥将在保存时清除；可输入新密钥' : row.credentialPresent ? '已加密保存 · 留空保留' : '保存在手机原生加密存储'}</span><input type="password" value={row.apiKey ?? ''} onChange={event => update({ apiKey: event.target.value })} autoComplete="off" /></label>
      {row.credentialPresent && !row.clearKey && <button className="text-button" onClick={() => update({ clearKey: true, apiKey: '' })}>清除这条连接的已存密钥</button>}
      <div className="model-picker-heading"><b>选择模型</b><button className="secondary" disabled={!native || busy || !row.endpoint} onClick={() => void act(async () => { const result = await bridge.rpc({ method: 'models.list', payload: { ...row } }); const value = result.data as { models: string[]; partial: boolean }; setCatalogs(current => ({ ...current, [row.id]: value })); notify(`已获取 ${value.models.length} 个模型${value.partial ? '（部分列表，可手动输入其他模型）' : ''}。`) })}>获取模型列表</button></div>
      {catalog && <div className="model-picker"><input aria-label="筛选模型" placeholder="搜索模型名称…" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="供应商模型列表" value={filtered.includes(row.model) ? row.model : ''} onChange={event => update({ model: event.target.value })}><option value="" disabled>选择模型 · {filtered.length} 个匹配</option>{filtered.map(model => <option key={model} value={model}>{model}</option>)}</select></div>}
      <label>模型名称<input value={row.model} onChange={event => update({ model: event.target.value })} placeholder="获取列表后选择，也可以手动输入" autoCapitalize="none" spellCheck={false} maxLength={256} /></label>
      <p className="caption">列表来自当前密钥的服务商，包含的模型不一定都支持聊天。列表不可用时仍可手动填写。</p>

      <details><summary>高级连接与备用分工</summary><div className="assignment-list">{roles.map(role => <label className="toggle" key={role.key}><input type="checkbox" checked={row[role.key]} onChange={event => update({ [role.key]: event.target.checked })} /><div><b>参与{role.name}</b></div></label>)}</div><label>模型列表地址（可选）<input value={row.modelsEndpoint ?? ''} onChange={event => update({ modelsEndpoint: event.target.value })} placeholder="默认由 API 地址推导 /models" autoCapitalize="none" /></label>{row.protocol === 'chat-completions' && <label>DeepSeek 兼容思考参数<select value={row.deepseekThinking ?? 'inherit'} onChange={event => update({ deepseekThinking: event.target.value as ModelProvider['deepseekThinking'] })}><option value="inherit">跟随服务商（不额外发送参数）</option><option value="disabled">关闭思考</option><option value="enabled">开启思考</option></select><span className="caption">仅适用于支持 thinking.type 的接口。</span></label>}<label className="toggle"><input type="checkbox" checked={row.enabled} onChange={event => update({ enabled: event.target.checked })} /><div><b>启用此连接</b><p>停用后保留配置，不参与模型分工。</p></div></label><div className="actions"><button className="secondary" disabled={providers[0]?.id === row.id} onClick={() => reorder(-1)}>优先级上移</button><button className="secondary" disabled={providers.at(-1)?.id === row.id} onClick={() => reorder(1)}>下移</button></div></details>
      <button className="secondary wide" disabled={!native || busy || !row.endpoint || !row.model} onClick={() => void act(async () => { const result = await bridge.rpc({ method: 'models.test', payload: { ...row } }); notify((result.data as { message: string }).message) })}>测试当前连接</button><p className="caption">测试会产生少量 API 费用。切换服务商后，请填写对应的密钥。</p>
    </fieldset></details>}</details>
    <details className="generation-settings"><summary>生成、识图与备用切换</summary><label className="toggle"><input type="checkbox" disabled={busy} checked={settings.modelOptions.visionEnabled === true} onChange={event => option({ visionEnabled: event.target.checked })} /><div><b>主模型识图</b><p>开启后可发送图片。请使用支持图片输入的主模型；保存并重启后生效，识图可能增加费用。</p></div></label><label className="toggle"><input type="checkbox" disabled={busy} checked={settings.modelOptions.mainStreamingMode === 'experimental'} onChange={event => option({ mainStreamingMode: event.target.checked ? 'experimental' : 'off', ...(event.target.checked ? { mainResponseFormat: 'json-object' } : {}) })} /><div><b>流式首条回复</b><p>沿用 HDS：通过 SSE 接收内容，首条完整回复提前送达，剧本继续生成。需接口支持流式与 JSON 模式。</p></div></label><label className="toggle"><input type="checkbox" disabled={busy} checked={settings.modelOptions.failoverEnabled} onChange={event => option({ failoverEnabled: event.target.checked })} /><div><b>主叙事失败时切换备用</b><p>为主叙事分配多条连接后生效；首条回复已送达时，不重发可见回复。</p></div></label><details><summary>采样、输出与兼容设置</summary><fieldset disabled={busy}>
      <div className="field-pair"><label>采样温度<input type="number" min="0" max="2" step="0.1" value={settings.modelOptions.mainTemperature} onChange={event => option({ mainTemperature: Number(event.target.value) })} /></label><label>最大输出 tokens<input type="number" min="256" max="100000" step="256" value={settings.modelOptions.mainMaxTokens} onChange={event => option({ mainMaxTokens: Number(event.target.value) })} /></label></div>
      <div className="field-pair"><label>请求超时（秒）<input type="number" min="5" max="300" value={settings.modelOptions.mainTimeout / 1000} onChange={event => option({ mainTimeout: Number(event.target.value) * 1000 })} /></label><label>模型选择顺序<select value={settings.modelOptions.failoverStrategy} onChange={event => option({ failoverStrategy: event.target.value as ModelOptions['failoverStrategy'] })}><option value="priority">按连接优先级</option><option value="round-robin">轮询分担</option></select></label></div>
      <label>结构化输出<select value={settings.modelOptions.mainResponseFormat} onChange={event => option({ mainResponseFormat: event.target.value as ModelOptions['mainResponseFormat'], ...(event.target.value === 'prompt-only' ? { mainStreamingMode: 'off' } : {}) })}><option value="json-object">JSON 模式（支持流式首条）</option><option value="prompt-only">仅提示词约束（兼容模式）</option></select></label><label>提示词排列<select value={settings.modelOptions.mainPayloadOrder} onChange={event => option({ mainPayloadOrder: event.target.value as ModelOptions['mainPayloadOrder'] })}><option value="cache-first">稳定内容优先 · 便于前缀缓存</option><option value="legacy">原始排列 · 兼容模式</option></select></label>
    </fieldset></details></details></details>
  </section>
}
