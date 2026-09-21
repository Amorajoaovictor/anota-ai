import { beforeEach, describe, expect, it, vi } from 'vitest'

type StoredBlob = { bytes: Uint8Array; uploadedAt: Date }

const sdk = vi.hoisted(() => {
  type Listed = { pathname: string; url: string; size: number; uploadedAt: Date }

  const entries = new Map<string, StoredBlob>()
  const pages: Array<{ blobs: Listed[]; cursor?: string; hasMore: boolean }> = []

  return {
    entries,
    pages,
    put: vi.fn(async (pathname: string, body: Uint8Array) => {
      entries.set(pathname, { bytes: body, uploadedAt: new Date() })
      return { pathname, url: `https://blob.test/${pathname}` }
    }),
    get: vi.fn(async (pathname: string) => {
      const entry = entries.get(pathname)
      if (!entry) return null
      return {
        statusCode: 200,
        headers: new Headers(),
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(entry.bytes)
            controller.close()
          },
        }),
        blob: { url: `https://blob.test/${pathname}`, pathname, uploadedAt: entry.uploadedAt, contentType: null, size: entry.bytes.byteLength },
      }
    }),
    del: vi.fn(async (pathname: string) => {
      entries.delete(pathname)
    }),
    list: vi.fn(async (options: { prefix?: string } = {}) => {
      if (pages.length > 0) return pages.shift()!
      return {
        blobs: [...entries.entries()]
          .filter(([key]) => !options.prefix || key.startsWith(options.prefix))
          .map(([pathname, entry]) => ({ pathname, url: `https://blob.test/${pathname}`, size: entry.bytes.byteLength, uploadedAt: entry.uploadedAt })),
        hasMore: false,
      }
    }),
  }
})

vi.mock('@vercel/blob', () => ({ put: sdk.put, get: sdk.get, del: sdk.del, list: sdk.list }))

import { getStorageConfig } from './config'
import { createVercelBlobStorage } from './vercel-blob'

const createStorage = () => createVercelBlobStorage({ token: 'blob-rw-token', access: 'private' })

describe('armazenamento de anexos no Vercel Blob', () => {
  beforeEach(() => {
    sdk.entries.clear()
    sdk.pages.length = 0
    sdk.put.mockClear()
    sdk.get.mockClear()
    sdk.del.mockClear()
    sdk.list.mockClear()
  })

  it('grava, lê e apaga o objeto pela chave do dono', async () => {
    const storage = createStorage()
    const bytes = new TextEncoder().encode('conteúdo')

    await storage.put('user-1/anexo-1', bytes)
    await expect(storage.read('user-1/anexo-1')).resolves.toEqual(bytes)

    await storage.delete('user-1/anexo-1')
    await expect(storage.read('user-1/anexo-1')).resolves.toBeNull()
  })

  it('devolve nulo para chave inexistente em vez de estourar', async () => {
    await expect(createStorage().read('user-1/ausente')).resolves.toBeNull()
  })

  it('usa o modo de acesso e o token configurados em toda a store', async () => {
    await createStorage().put('user-1/anexo-1', new Uint8Array([1]))

    expect(sdk.put).toHaveBeenCalledWith('user-1/anexo-1', expect.any(Uint8Array), expect.objectContaining({
      access: 'private',
      token: 'blob-rw-token',
      addRandomSuffix: false,
    }))
  })

  /**
   * H16 protege: sweeper consegue enumerar objetos pelo prefixo sem expor caminho absoluto.
   * Detecta: consulta de listagem sem prefixo, que traria anexos do dono inteiro.
   * Impacto: audio orfao nunca entra na politica de 24 horas.
   */
  it('lista objetos seguros por prefixo com data tecnica', async () => {
    const storage = createStorage()
    await storage.put('inbox-audio/user-1/a', new Uint8Array([1]))
    await storage.put('attachments/user-1/b', new Uint8Array([2]))

    const entries = await storage.list('inbox-audio/')

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ key: 'inbox-audio/user-1/a', updatedAt: expect.any(Date) })
    expect(sdk.list).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'inbox-audio/' }))
  })

  it('percorre todas as páginas da listagem', async () => {
    const storage = createStorage()
    const uploadedAt = new Date()
    sdk.pages.push(
      { blobs: [{ pathname: 'inbox-audio/user-1/a', url: 'u1', size: 1, uploadedAt }], cursor: 'pagina-2', hasMore: true },
      { blobs: [{ pathname: 'inbox-audio/user-1/b', url: 'u2', size: 1, uploadedAt }], hasMore: false },
    )

    const entries = await storage.list('inbox-audio/')

    expect(entries.map((entry) => entry.key)).toEqual(['inbox-audio/user-1/a', 'inbox-audio/user-1/b'])
    expect(sdk.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'pagina-2' }))
  })

  it('recusa chave que tenta escapar do prefixo do dono', async () => {
    const storage = createStorage()

    await expect(storage.put('../fora', new Uint8Array([1]))).rejects.toThrow('Chave de armazenamento inválida')
    await expect(storage.read('/etc/passwd')).rejects.toThrow('Chave de armazenamento inválida')
    await expect(storage.delete('user-1\\..\\..\\fora')).rejects.toThrow('Chave de armazenamento inválida')
  })

  it('aceita o driver com store privada e token, recusando configuração incompleta', () => {
    expect(getStorageConfig({ STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'blob-rw-token' })).toEqual({
      driver: 'vercel-blob',
      blobAccess: 'private',
      blobToken: 'blob-rw-token',
      maxUploadBytes: 26214400,
    })
    expect(getStorageConfig({
      STORAGE_DRIVER: 'vercel-blob',
      STORAGE_BLOB_ACCESS: 'public',
      BLOB_READ_WRITE_TOKEN: 'blob-rw-token',
    })).toMatchObject({ blobAccess: 'public' })

    expect(() => getStorageConfig({ STORAGE_DRIVER: 'vercel-blob' })).toThrow('BLOB_READ_WRITE_TOKEN')
    expect(() => getStorageConfig({
      STORAGE_DRIVER: 'vercel-blob',
      STORAGE_BLOB_ACCESS: 'todos',
      BLOB_READ_WRITE_TOKEN: 'blob-rw-token',
    })).toThrow('STORAGE_BLOB_ACCESS')
  })
})
