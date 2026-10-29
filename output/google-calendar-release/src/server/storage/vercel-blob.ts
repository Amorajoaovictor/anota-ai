import { del, get, list, put } from '@vercel/blob'
import { assertSafeKey, type StorageDriver } from './driver'

export type VercelBlobStorageOptions = {
  token: string
  /** Precisa bater com o modo de acesso da store: store privada recusa `put` público e vice-versa. */
  access: 'public' | 'private'
}

const LIST_PAGE_SIZE = 1000

/**
 * Alias do driver para o Vercel Blob. O filesystem da função é somente leitura fora de `/tmp`,
 * que é efêmero por instância — sem object storage o anexo some no próximo cold start.
 */
export function createVercelBlobStorage({ token, access }: VercelBlobStorageOptions): StorageDriver {
  return {
    async put(key, bytes) {
      // `Buffer.from` sobre o mesmo ArrayBuffer: view, sem copiar o arquivo a caminho do upload.
      const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      await put(assertSafeKey(key), body, { access, token, addRandomSuffix: false, allowOverwrite: true })
    },

    async read(key) {
      const result = await get(assertSafeKey(key), { access, token })
      if (!result || result.statusCode !== 200) return null
      return new Uint8Array(await new Response(result.stream).arrayBuffer())
    },

    async delete(key) {
      await del(assertSafeKey(key), { token })
    },

    async list(prefix) {
      const safePrefix = assertSafeKey(prefix)
      const entries: Array<{ key: string; updatedAt: Date }> = []

      let cursor: string | undefined
      do {
        const page = await list({ prefix: safePrefix, token, cursor, limit: LIST_PAGE_SIZE })
        entries.push(...page.blobs.map((blob) => ({ key: blob.pathname, updatedAt: blob.uploadedAt })))
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)

      return entries
    },
  }
}
