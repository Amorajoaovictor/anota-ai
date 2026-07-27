import { assertSafeKey, type StorageDriver } from './driver'

export function createMemoryStorage(): StorageDriver & { entries: Map<string, Uint8Array> } {
  const entries = new Map<string, Uint8Array>()

  return {
    entries,
    async put(key, bytes) {
      entries.set(assertSafeKey(key), bytes)
    },
    async read(key) {
      return entries.get(assertSafeKey(key)) ?? null
    },
    async delete(key) {
      entries.delete(assertSafeKey(key))
    },
  }
}
