import { h } from 'koishi'

export type PushRow = { id: string; direction: string; content: string; occurredAt: Date | string; status?: string }
// Reuse Koishi's parser so image URLs/markup never become notification body text.
export function messagePush(row: Pick<PushRow, 'id' | 'content' | 'occurredAt'>) {
  const plain = h.parse(row.content).map(element => element.type === 'text' ? element.attrs.content : '').join('').trim()
  const fullContent = plain || '[图片]'
  return { id: row.id, content: Array.from(fullContent.split(/\r?\n/)[0]).slice(0, 40).join(''), fullContent, occurredAt: new Date(row.occurredAt).toISOString() }
}
export function serializeMessagePush(row: Pick<PushRow, 'id' | 'content' | 'occurredAt'>) {
  return `HDS_MSG_PUSH ${JSON.stringify(messagePush(row))}\n`
}
export function messagesSinceQuery(since: unknown) {
  if (typeof since !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(since) || !Number.isFinite(Date.parse(since))) throw new Error('since 必须是 ISO 时间')
  return { direction: 'character', occurredAt: { $gt: new Date(since) } }
}
