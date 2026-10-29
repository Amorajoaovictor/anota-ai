import { assertSafeKey, type StorageDriver } from './driver'

export function createMemoryStorage(): StorageDriver & { entries: Map<string, Uint8Array> } {
  const entries = new Map<string, Uint8Array>()
  const updatedAt = new Map<string, Date>()

  return {
    entries,
    async put(key, bytes) {
      const safeKey = assertSafeKey(key)
      entries.set(safeKey, bytes)
      updatedAt.set(safeKey, new Date())
    },
    async read(key) {
      return entries.get(assertSafeKey(key)) ?? null
    },
    async delete(key) {
      const safeKey = assertSafeKey(key)
      entries.delete(safeKey)
      updatedAt.delete(safeKey)
    },
    async list(prefix) {
      const safePrefix = assertSafeKey(prefix)
      return [...entries.keys()]
        .filter((key) => key.startsWith(safePrefix))
        .map((key) => ({ key, updatedAt: updatedAt.get(key) ?? new Date(0) }))
    },
  }
}
