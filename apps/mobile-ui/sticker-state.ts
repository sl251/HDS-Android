import { visionProjection, visionRouteReason, type ModelSettings } from '../../packages/contracts'

export function stickerImportReason(settings: Pick<ModelSettings, 'providers' | 'modelOptions'>): string | undefined {
  if (!settings.modelOptions.visionEnabled) return '请先到模型设置开启图片理解，并配置可用的识图模型，再导入表情包。'
  try {
    const route = visionProjection(settings)
    const reason = visionRouteReason(route)
    if (reason) return `${reason}，暂不能导入表情包。`
    if (route.candidates.some(row => !row.model || !/^https?:\/\//.test(row.endpoint))) return '请补全识图模型的 API 地址和模型名称，再导入表情包。'
  } catch { return '请补全识图模型的 API 地址和模型名称，再导入表情包。' }
}

export type StickerAsset = { id: string; path: string; size: number; mime: string }
export type Sticker = StickerAsset & { lastUsed: number }
export type StickerPool = 'user' | 'character'
export type StickerPack = { id: string; name: string; createdAt: number; stickers: Sticker[]; pool?: StickerPool }
export type StickerLibrary = { packs: StickerPack[]; messages: Record<string, StickerAsset> }
export const emptyLibrary = (): StickerLibrary => ({ packs: [], messages: {} })
export const poolLibrary = (library: StickerLibrary, pool: StickerPool): StickerLibrary => ({ ...library, packs: library.packs.filter(pack => (pack.pool ?? 'user') === pool) })
export const stickerEntryVisible = (library: StickerLibrary) => poolLibrary(library, 'user').packs.some(pack => pack.stickers.length > 0)
export const sortedPacks = (library: StickerLibrary) => [...library.packs].sort((a, b) => Math.max(0, ...b.stickers.map(s => s.lastUsed)) - Math.max(0, ...a.stickers.map(s => s.lastUsed)) || b.createdAt - a.createdAt)
export function recentStickers(library: StickerLibrary) {
  const seen = new Set<string>()
  return library.packs.flatMap(pack => pack.stickers.map(sticker => ({ packId: pack.id, sticker }))).filter(item => item.sticker.lastUsed > 0).sort((a, b) => b.sticker.lastUsed - a.sticker.lastUsed).filter(({ sticker }) => { if (seen.has(sticker.id)) return false; seen.add(sticker.id); return true }).slice(0, 16)
}
export function importIntoPack(library: StickerLibrary, packId: string, name: string, assets: StickerAsset[], now = Date.now(), pool: StickerPool = 'user') {
  if (library.packs.some(pack => pack.id === packId && (pack.pool ?? 'user') !== pool)) throw new Error('表情包属于另一个素材池，请重新选择导入位置')
  const pack = library.packs.find(pack => pack.id === packId && (pack.pool ?? 'user') === pool) ?? { id: packId, name: name.trim() || '我的表情', createdAt: now, stickers: [], pool }
  const ids = new Set(pack.stickers.map(s => s.id)), added: Sticker[] = []
  for (const asset of assets) if (!ids.has(asset.id)) { ids.add(asset.id); added.push({ ...asset, lastUsed: 0 }) }
  return { library: { ...library, packs: [...library.packs.filter(p => p.id !== packId), { ...pack, stickers: [...pack.stickers, ...added] }] }, imported: added.length, skipped: assets.length - added.length }
}
export function useSticker(library: StickerLibrary, packId: string, id: string, now = Date.now()): StickerLibrary {
  return { ...library, packs: library.packs.map(pack => pack.id === packId ? { ...pack, stickers: pack.stickers.map(sticker => sticker.id === id ? { ...sticker, lastUsed: now } : sticker) } : pack) }
}
export const stickerMessageKey = (cardId: string, messageId: string) => `${cardId}:${messageId}`
export function libraryBytes(library: StickerLibrary) {
  return [...new Map([...library.packs.flatMap(pack => pack.stickers), ...Object.values(library.messages)].map(asset => [asset.id, asset.size])).values()].reduce((sum, size) => sum + size, 0)
}
export function readLibrary(storage: Pick<Storage, 'getItem'>): StickerLibrary {
  try { const value = JSON.parse(storage.getItem('hds-stickers-v1') || 'null'); return value && Array.isArray(value.packs) && value.messages && typeof value.messages === 'object' ? value : emptyLibrary() } catch { return emptyLibrary() }
}

/** Send IDs only; native code resolves private paths and exports current packs at startup. */
export const stickerSyncPacks = (library: StickerLibrary) => library.packs.map(pack => ({ id: pack.id, name: pack.name, pool: pack.pool ?? 'user', ids: [...new Set(pack.stickers.map(asset => asset.id))] }))
