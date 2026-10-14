import type { ModelProvider } from '../../packages/contracts'

export type ModelTask = 'useForMain' | 'useForCompaction' | 'useForAlter'
export const assigned = (rows: ModelProvider[], task: ModelTask) => rows.filter(row => row.enabled && row[task]).map(row => row.id)
export function followsMain(rows: ModelProvider[], task: ModelTask) {
  return JSON.stringify(assigned(rows, task)) === JSON.stringify(assigned(rows, 'useForMain'))
}
export function assignTask(rows: ModelProvider[], task: ModelTask, id: string): ModelProvider[] {
  const inherited = (['useForCompaction', 'useForAlter'] as const).filter(key => followsMain(rows, key))
  const targets = id === 'inherit' ? assigned(rows, 'useForMain') : [id]
  return rows.map(row => ({ ...row, [task]: targets.includes(row.id),
    ...(task === 'useForMain' ? Object.fromEntries(inherited.map(key => [key, row.id === id])) : {}) }))
}
export function removeProvider(rows: ModelProvider[], id: string): ModelProvider[] {
  let next = rows.filter(row => row.id !== id)
  const fallback = next.find(row => row.enabled)
  if (!fallback) return next
  for (const task of ['useForMain', 'useForCompaction', 'useForAlter'] as const) {
    if (!assigned(next, task).length) next = assignTask(next, task, task === 'useForMain' ? fallback.id : 'inherit')
  }
  return next
}
