import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** Synchronous mutations never yield between reading state and atomic replacement. */
export function atomicState<T>(file: string, initial: () => T) {
  mkdirSync(dirname(file), { recursive: true })
  let value: T = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : initial()
  return {
    read: () => structuredClone(value),
    change<R>(mutate: (draft: T) => R): R {
      const draft = structuredClone(value), result = mutate(draft)
      writeFileSync(file + '.tmp', JSON.stringify(draft), { mode: 0o600 })
      renameSync(file + '.tmp', file)
      value = draft
      return result
    },
  }
}
