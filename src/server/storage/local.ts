import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
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
    async list(prefix) {
      const safePrefix = assertSafeKey(prefix)
      const files = await walkFiles(join(root, safePrefix)).catch((error) => {
        if (isMissingFile(error)) return []
        throw error
      })
      return Promise.all(files.map(async (path) => ({
        key: relative(root, path).replaceAll('\\', '/'),
        updatedAt: (await stat(path)).mtime,
      })))
    },
  }
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return walkFiles(path)
    return entry.isFile() ? [path] : []
  }))
  return nested.flat()
}

function isMissingFile(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
