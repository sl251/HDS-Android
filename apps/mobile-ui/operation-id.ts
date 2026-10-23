/** Preserve an operation ID after a lost receipt, including a WebView restart. */
export function operationId(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key: string, value: unknown) {
  const signature = JSON.stringify(value)
  let previous: { signature?: string; id?: string } = {}
  try { previous = JSON.parse(storage.getItem(key) || '{}') } catch { /* Invalid cache is replaced. */ }
  const id = previous.signature === signature && typeof previous.id === 'string' ? previous.id : crypto.randomUUID()
  storage.setItem(key, JSON.stringify({ signature, id }))
  return { id, done: () => storage.removeItem(key) }
}
