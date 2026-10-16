import type { Message } from '../../packages/contracts'

/** Store only a per-card reply timestamp. Storage failures still allow an in-memory view. */
export function createReplyWatermarks(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = () => localStorage) {
  const timestamps = new Map<string, number>()
  const key = (cardId: string) => `hds-lastCharacterReplyTs-${cardId}`
  const get = (cardId: string): number => {
    if (!cardId) return 0
    if (!timestamps.has(cardId)) {
      let value = 0
      try { value = Number(storage().getItem(key(cardId))) } catch { /* WebView storage may be unavailable. */ }
      timestamps.set(cardId, Number.isFinite(value) && value > 0 ? value : 0)
    }
    return timestamps.get(cardId)!
  }
  return {
    get,
    observe(cardId: string, messages: Message[]) {
      if (!cardId) return 0
      const previous = get(cardId)
      const latest = messages.reduce((ts, message) => {
        const reply = message.direction === 'character' && message.status === 'delivered' ? Date.parse(message.occurredAt) : NaN
        return Number.isFinite(reply) ? Math.max(ts, reply) : ts
      }, previous)
      if (latest !== previous) {
        timestamps.set(cardId, latest)
        try { storage().setItem(key(cardId), String(latest)) } catch { /* Keep the in-memory watermark. */ }
      }
      return latest
    },
    clear(cardId: string) {
      timestamps.delete(cardId)
      try { storage().removeItem(key(cardId)) } catch { /* Keep a cleared in-memory watermark. */ }
      timestamps.set(cardId, 0)
    },
  }
}
