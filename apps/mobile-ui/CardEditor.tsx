import React, { useState } from 'react'
import type { SavedCard } from '../../packages/contracts'
import type { Card } from '../../packages/card-format'
import { editPersona } from '../../packages/persona-format'

export function CardEditor({ saved, busy, close, save }: { saved: SavedCard; busy: boolean; close: () => void; save: (card: Card) => Promise<void> }) {
  const [draft, setDraft] = useState<Card>(() => structuredClone(saved.card))
  const [error, setError] = useState('')
  const textFields = [{ key: 'description', label: '角色档案', rows: 6 }, { key: 'personality', label: '性格', rows: 3 }, { key: 'scenario', label: '世界与场景', rows: 4 }, { key: 'firstMessage', label: '开场白', rows: 3 }, { key: 'examples', label: '示例对话', rows: 4 }, { key: 'systemPrompt', label: '角色系统提示词', rows: 3 }, { key: 'postHistoryInstructions', label: '历史后置指令', rows: 3 }] as const
  const hdsFields = [{ key: 'relationship', label: '初始关系' }, { key: 'location', label: '初始地点' }, { key: 'perspective', label: '叙事视角' }, { key: 'supportingCast', label: '配角' }, { key: 'style', label: '文风' }, { key: 'userProfile', label: '预设中的用户档案' }, { key: 'timezone', label: '故事时区' }]
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="编辑角色人设"><div className="section-title"><div><span className="eyebrow">CHARACTER / EDIT</span><h2>修改人设</h2></div><button aria-label="关闭编辑" disabled={busy} onClick={close}>×</button></div>
    <p className="caption">保留角色 ID、剧情和记忆。保存当前角色会停止 HDS；重新启动后应用新档案。修改开场白不会重复发送。</p>
    {error && <p role="alert" className="error">{error}</p>}
    <fieldset disabled={busy}><label>角色名称<input maxLength={draft.format === 'hds' ? 60 : 128} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      {textFields.filter(field => draft.format !== 'hds' || ['description', 'scenario'].includes(field.key)).map(field => <label key={field.key}>{field.label}<textarea rows={field.rows} value={draft[field.key]} maxLength={draft.format === 'hds' ? 20000 : 262144} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} /></label>)}
      {draft.format === 'hds' && draft.hds && <details><summary>其他 HDS 原生设定</summary>{hdsFields.map(field => <label key={field.key}>{field.label}<textarea rows={field.key === 'timezone' ? 1 : 3} value={String(draft.hds!.storyDefaults[field.key] ?? '')} onChange={event => setDraft({ ...draft, hds: { storyDefaults: { ...draft.hds!.storyDefaults, [field.key]: event.target.value } } })} /></label>)}{['perspectives', 'supplementaryFacts'].map(key => <label key={key}>{key === 'perspectives' ? '多重视角（每行一条）' : '补充事实（每行一条）'}<textarea rows={3} value={((draft.hds!.storyDefaults[key] as string[] | undefined) ?? []).join('\n')} onChange={event => setDraft({ ...draft, hds: { storyDefaults: { ...draft.hds!.storyDefaults, [key]: event.target.value.split('\n').filter(Boolean) } } })} /></label>)}</details>}
      <button className="primary wide" disabled={busy || !draft.name.trim() || !draft.description.trim()} onClick={async () => { try { setError(''); await save(editPersona(draft, draft)) } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } }}>保存修改</button>
    </fieldset>
  </section></div>
}
