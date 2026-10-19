import { readdirSync, realpathSync } from 'node:fs'
import { join, resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Only the current exported library enables the upstream catalog, never stale DB rows. */
export function localStickerConfig(dataDir: string) {
  const directory = resolve(dataDir, 'stickers')
  let enabled = false
  try {
    enabled = readdirSync(directory, { withFileTypes: true }).some(group => group.isDirectory() &&
      readdirSync(join(directory, group.name), { withFileTypes: true }).some(file => file.isFile() && /^[a-f0-9]{64}\.(gif|png|webp|jpg)$/.test(file.name)))
  } catch { /* Absent export is an empty library. */ }
  return { enabled, directory, maxFileSizeMB: 10 }
}

export async function stickerFileForSource(src: string, directory: string, lookup: (id: string) => Promise<{ filePath: string } | undefined>) {
  let file: string
  try {
    if (/^https?:/.test(src)) {
      const url = new URL(src), prefix = '/hds-interlude/sticker/'
      if (!url.pathname.startsWith(prefix)) return undefined
      const asset = await lookup(decodeURIComponent(url.pathname.slice(prefix.length)))
      if (!asset) return undefined
      file = resolve(directory, asset.filePath)
    } else {
      file = src.startsWith('file:') ? fileURLToPath(src) : resolve(directory, src)
    }
    const root = realpathSync(directory), actual = realpathSync(file), inside = relative(root, actual)
    if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside) || !/\.(gif|png|webp|jpe?g)$/i.test(actual)) return undefined
    return actual
  } catch { return undefined }
}

/** rc51's generic typed-message examples mention stickers even without a catalog.
 * Remove those stock examples for mobile's empty-library contract; QQ keeps its prompt.
 */
export function emptyStickerSystemPrompt(prompt: string) {
  return prompt
    .replace(/(?:Stickers and emoji-like images|A cat sticker|Sending the same sticker)[^.\n]*\.\s*/g, '')
    .replace(/such as a sticker or native face/g, 'such as a native face')
}

/** Koishi camel-cases image attributes, so sub_type must cross the OneBot
 * boundary as JSON. Sending it as an <img> attribute silently becomes subType. */
export async function oneBotStickerDelivery(bot: { platform: string; internal?: { sendGroupMsg: (id: string, message: unknown[]) => Promise<unknown>; sendPrivateMsg: (id: string, message: unknown[]) => Promise<unknown> } }, channel: string, src: string, group: boolean, fallback: () => Promise<unknown>) {
  if (bot.platform !== 'onebot') return fallback()
  const id = channel.replace(/^(?:private|group):/, '')
  if (!/^\d+$/.test(id) || !bot.internal) throw new Error('表情包目标或 OneBot 接口无效')
  const message = [{ type: 'image', data: { file: src, sub_type: 1, summary: '[表情包]' } }]
  const receipt = group ? await bot.internal.sendGroupMsg(id, message) : await bot.internal.sendPrivateMsg(id, message)
  // Koishi's internal methods extract message_id and return the scalar ID.
  if ((typeof receipt !== 'number' && typeof receipt !== 'string') || String(receipt) === '') throw Object.assign(new Error('表情包发送结果未知'), { ambiguous: true })
  return receipt
}
