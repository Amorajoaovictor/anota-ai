import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getStorageConfig } from './config'
import { createLocalStorage } from './local'

describe('armazenamento local de anexos', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'anexos-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('grava, lê e apaga o objeto pela chave do dono', async () => {
    const storage = createLocalStorage(root)
    const bytes = new TextEncoder().encode('conteúdo')

    await storage.put('user-1/anexo-1', bytes)
    await expect(storage.read('user-1/anexo-1')).resolves.toEqual(bytes)

    await storage.delete('user-1/anexo-1')
    await expect(storage.read('user-1/anexo-1')).resolves.toBeNull()
  })

  it('devolve nulo para chave inexistente em vez de estourar', async () => {
    await expect(createLocalStorage(root).read('user-1/ausente')).resolves.toBeNull()
  })

  it('recusa chave que tenta escapar do diretório', async () => {
    const storage = createLocalStorage(root)

    await expect(storage.put('../fora', new Uint8Array([1]))).rejects.toThrow('Chave de armazenamento inválida')
    await expect(storage.read('/etc/passwd')).rejects.toThrow('Chave de armazenamento inválida')
    await expect(storage.delete('user-1\\..\\..\\fora')).rejects.toThrow('Chave de armazenamento inválida')
  })

  it('usa driver local e limite padrão quando o ambiente não define nada', () => {
    expect(getStorageConfig({})).toEqual({ driver: 'local', directory: 'var/storage', maxUploadBytes: 26214400 })
  })

  it('recusa driver desconhecido e limite inválido', () => {
    expect(() => getStorageConfig({ STORAGE_DRIVER: 's3' })).toThrow('STORAGE_DRIVER inválido')
    expect(() => getStorageConfig({ MAX_UPLOAD_BYTES: '0' })).toThrow('MAX_UPLOAD_BYTES')
  })
})
