import { getStorageConfig, readStorageEnvironment, type StorageConfig } from './config'
import type { StorageDriver } from './driver'
import { createLocalStorage } from './local'
import { createMemoryStorage } from './memory'
import { createVercelBlobStorage } from './vercel-blob'

let storage: StorageDriver | undefined

export function getStorage() {
  if (storage) return storage
  storage = buildStorage(getStorageConfig(readStorageEnvironment()))
  return storage
}

function buildStorage(config: StorageConfig): StorageDriver {
  switch (config.driver) {
    case 'memory':
      return createMemoryStorage()
    case 'vercel-blob':
      return createVercelBlobStorage({ token: config.blobToken, access: config.blobAccess })
    case 'local':
      return createLocalStorage(config.directory)
  }
}

export function getMaxUploadBytes() {
  return getStorageConfig(readStorageEnvironment()).maxUploadBytes
}

export type { StorageDriver } from './driver'
