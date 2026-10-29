export type BlobAccess = 'public' | 'private'

export type StorageConfig =
  /** Filesystem local: desenvolvimento e execução fora do Vercel. */
  | { driver: 'local'; directory: string; maxUploadBytes: number }
  /** Volátil por processo: testes. */
  | { driver: 'memory'; maxUploadBytes: number }
  /** Vercel Blob: único armazenamento durável dentro de uma função Vercel. */
  | { driver: 'vercel-blob'; blobAccess: BlobAccess; blobToken: string; maxUploadBytes: number }

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function readStorageEnvironment(): Record<string, string | undefined> {
  return {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_DIR: process.env.STORAGE_DIR,
    STORAGE_BLOB_ACCESS: process.env.STORAGE_BLOB_ACCESS,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  }
}

export function getStorageConfig(environment: Record<string, string | undefined>): StorageConfig {
  const driver = environment.STORAGE_DRIVER?.trim() || 'local'
  if (driver !== 'local' && driver !== 'memory' && driver !== 'vercel-blob') {
    throw new Error(`STORAGE_DRIVER inválido: ${driver}. Use "local", "memory" ou "vercel-blob".`)
  }

  const maxUploadBytes = Number(environment.MAX_UPLOAD_BYTES?.trim() || DEFAULT_MAX_UPLOAD_BYTES)
  if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) {
    throw new Error('MAX_UPLOAD_BYTES deve ser um número positivo.')
  }

  if (driver === 'memory') return { driver, maxUploadBytes }
  if (driver === 'local') {
    return { driver, directory: environment.STORAGE_DIR?.trim() || 'var/storage', maxUploadBytes }
  }

  // Fail-closed: sem token o anexo iria para lugar nenhum no meio do upload.
  const blobToken = environment.BLOB_READ_WRITE_TOKEN?.trim()
  if (!blobToken) throw new Error('BLOB_READ_WRITE_TOKEN é obrigatório com STORAGE_DRIVER="vercel-blob".')

  const blobAccess = environment.STORAGE_BLOB_ACCESS?.trim() || 'private'
  if (blobAccess !== 'private' && blobAccess !== 'public') {
    throw new Error(`STORAGE_BLOB_ACCESS inválido: ${blobAccess}. Use "private" ou "public".`)
  }

  return { driver, blobAccess, blobToken, maxUploadBytes }
}
