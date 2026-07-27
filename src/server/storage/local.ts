import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { assertSafeKey, type StorageDriver } from './driver'

export function createLocalStorage(root: string): StorageDriver {
  const resolve = (key: string) => join(root, assertSafeKey(key))

  return {
    async put(key, bytes) {
      const path = resolve(key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
    },
    async read(key) {
      try {
        return new Uint8Array(await readFile(resolve(key)))
      } catch (error) {
        if (isMissingFile(error)) return null
        throw error
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true })
    },
  }
}

function isMissingFile(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
