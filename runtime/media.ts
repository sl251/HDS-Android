import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function imageStore(directory: string) {
  const root = join(directory, 'images')
  mkdirSync(root, { recursive: true })
  const path = (id: string) => { if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('无效图片编号'); return join(root, `${id}.jpg`) }
  return {
    save(dataUri: unknown) {
      if (typeof dataUri !== 'string' || dataUri.length > 700000) throw new Error('图片过大，请重新选择')
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri)
      if (!match) throw new Error('仅支持选图后压缩的 JPEG 图片')
      const bytes = Buffer.from(match[1], 'base64')
      if (bytes.length < 4 || bytes.length > 500000 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217 || bytes.toString('base64') !== match[1]) throw new Error('无效 JPEG 图片')
      const id = createHash('sha256').update(bytes).digest('hex')
      if (!existsSync(path(id))) writeFileSync(path(id), bytes, { flag: 'wx', mode: 0o600 })
      return { id, dataUri }
    },
    get(id: string) { return `data:image/jpeg;base64,${readFileSync(path(id)).toString('base64')}` },
    requestId: () => randomUUID(),
  }
}
