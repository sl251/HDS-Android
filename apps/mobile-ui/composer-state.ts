import type { ImageAttachment } from '../../packages/contracts'

export type Draft = { content: string; attachments: ImageAttachment[] }
const empty = (): Draft => ({ content: '', attachments: [] })
export function createDraftStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const key = (cardId: string) => `hds-draft-${cardId}`
  return {
    read(cardId: string): Draft {
      if (!cardId) return empty()
      try {
        const value = JSON.parse(storage.getItem(key(cardId)) || 'null')
        return value ? { content: typeof value.content === 'string' ? value.content : '', attachments: Array.isArray(value.attachments) ? value.attachments.filter((image: ImageAttachment) => /^[a-f0-9]{64}$/.test(image?.id) && /^data:image\//.test(image?.dataUri)).slice(0, 3) : [] } : empty()
      } catch { return empty() }
    },
    write(cardId: string, value: Draft) {
      if (!cardId) return
      if (!value.content && !value.attachments.length) storage.removeItem(key(cardId))
      else storage.setItem(key(cardId), JSON.stringify(value))
    },
  }
}

/** Some Android WebViews only report IME composition through the legacy 229 code. */
export function composerEnter(event: { key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number }, composing = false) {
  if (event.key !== 'Enter' || event.shiftKey) return 'newline'
  return composing || event.isComposing || event.keyCode === 229 ? 'composition' : 'send'
}

/** Match provider reasoning fields when present, and literal think blocks left in content.
 * The current mobile history schema has no reasoning duration: never estimate it from arrival time. */
export function splitThinking(message: { content: string; reasoning_content?: string }) {
  const thoughts = message.reasoning_content ? [message.reasoning_content] : []
  const content = message.content.replace(/<think>([\s\S]*?)(?:<\/think>|$)/gi, (_, thought: string) => { if (thought.trim()) thoughts.push(thought.trim()); return '' }).trim()
  return { content, thought: thoughts.join('\n\n') }
}
