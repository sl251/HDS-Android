import { CapacitorHttp } from '@capacitor/core'
import type { Card } from '../../packages/card-format'
import { importBytes, parsePersona } from '../../packages/persona-format'
import { fetchShare } from './share-sanitizer.js'

export type CharacterImport = { card: Card; base64: string }
export function prepareCharacterImport(card: Card, original: Uint8Array = new Uint8Array()): CharacterImport {
  const bytes = importBytes(card, original)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return { card, base64: btoa(binary) }
}
export type SharedCharacter = CharacterImport & { code: string; title: string; revision: number; fingerprint: string }
/** A library import never mutates the active story or its global settings. */
export async function inspectSharedCharacter(code: string, expected?: string, get = CapacitorHttp.get): Promise<SharedCharacter> {
  const { info } = await fetchShare({ http: { get: async (url: string) => {
    const response = await get({ url, connectTimeout: 15000, readTimeout: 15000, responseType: 'json' })
    if (response.status !== 200) throw { response: { status: response.status, json: async () => response.data } }
    return response.data
  } } }, 'https://typ0.space', code)
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([info.code, info.revision, info.payload])))), b => b.toString(16).padStart(2, '0')).join('')
  if (expected && fingerprint !== expected) throw new Error('分享内容已变化，请重新检查后导入。')
  const [card] = parsePersona(new TextEncoder().encode(JSON.stringify(info.payload)))
  return { ...prepareCharacterImport(card), code: info.code, title: info.title, revision: info.revision, fingerprint }
}
