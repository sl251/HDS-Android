import { readdirSync, realpathSync } from 'node:fs'
import { join, resolve, relative, isAbsolute } from 'node:path'
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
    if (!inside || inside === '..' || /^\.\.[\\/]/.test(inside) || isAbsolute(inside) || !/\.(gif|png|webp|jpe?g)$/i.test(actual)) return undefined
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
