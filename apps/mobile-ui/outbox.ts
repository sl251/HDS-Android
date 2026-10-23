import { messageAudio, messageImages, type Message } from '../../packages/contracts'

export function outbox(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const key = (cardId: string) => `hds-outbox-v1-${cardId}`
  const read = (cardId: string): Message[] => {
    try { const rows = JSON.parse(storage.getItem(key(cardId)) || '[]'); return Array.isArray(rows) ? rows.filter(row => /^[\w-]{8,64}$/.test(row.id) && typeof row.content === 'string').map(row => ({ ...row, images: messageImages(row.images), audio: messageAudio(row.audio), status: row.status === 'sending' ? 'unknown' : row.status })) : [] } catch { return [] }
  }
  return {
    read,
    put(cardId: string, message: Message) { const rows = read(cardId).filter(row => row.id !== message.id); if (rows.length >= 100) throw new Error('待发消息过多，请先处理失败消息'); storage.setItem(key(cardId), JSON.stringify([...rows, message])) },
    remove(cardId: string, ids: string[]) { storage.setItem(key(cardId), JSON.stringify(read(cardId).filter(row => !ids.includes(row.id)))) },
  }
}
