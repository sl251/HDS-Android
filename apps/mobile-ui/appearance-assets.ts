import { Capacitor } from '@capacitor/core'
import type { Appearance } from '../../packages/contracts'

export function appearanceAssets(value: Appearance): Appearance {
  const source = (path: string | undefined, revision: number | undefined, fallback: string | undefined) => path ? `${Capacitor.convertFileSrc(path)}?v=${Number.isFinite(revision) ? revision : 0}` : fallback
  return { ...value, backgroundData: source(value.backgroundPath, value.backgroundRevision, value.backgroundData), fontData: source(value.fontPath, value.fontRevision, value.fontData) }
}
