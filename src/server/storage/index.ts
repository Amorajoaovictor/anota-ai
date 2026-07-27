import { getStorageConfig, readStorageEnvironment } from './config'
import type { StorageDriver } from './driver'
import { createLocalStorage } from './local'
import { createMemoryStorage } from './memory'

let storage: StorageDriver | undefined

export function getStorage() {
  if (storage) return storage
  const config = getStorageConfig(readStorageEnvironment())
  storage = config.driver === 'memory' ? createMemoryStorage() : createLocalStorage(config.directory)
  return storage
}

export function getMaxUploadBytes() {
  return getStorageConfig(readStorageEnvironment()).maxUploadBytes
}

export type { StorageDriver } from './driver'
