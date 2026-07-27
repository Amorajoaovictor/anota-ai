export type StorageConfig = {
  driver: 'local' | 'memory'
  directory: string
  maxUploadBytes: number
}

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function readStorageEnvironment(): Record<string, string | undefined> {
  return {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_DIR: process.env.STORAGE_DIR,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  }
}

export function getStorageConfig(environment: Record<string, string | undefined>): StorageConfig {
  const driver = environment.STORAGE_DRIVER?.trim()
  if (driver && driver !== 'local' && driver !== 'memory') {
    throw new Error(`STORAGE_DRIVER inválido: ${driver}. Use "local" ou "memory".`)
  }
  const maxUploadBytes = Number(environment.MAX_UPLOAD_BYTES?.trim() || DEFAULT_MAX_UPLOAD_BYTES)
  if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) {
    throw new Error('MAX_UPLOAD_BYTES deve ser um número positivo.')
  }
  return {
    driver: driver === 'memory' ? 'memory' : 'local',
    directory: environment.STORAGE_DIR?.trim() || 'var/storage',
    maxUploadBytes,
  }
}
