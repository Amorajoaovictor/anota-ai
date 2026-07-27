import { describe, expect, it } from 'vitest'
import { createAttachment, deleteAttachment, readAttachment } from './attachments'
import { createMemoryStorage } from './storage/memory'
import { createFakeContentStore } from '../test/fake-prisma'

const limits = { maxUploadBytes: 1024 }
const upload = (bytes = new Uint8Array([1, 2, 3]), contentType = 'image/png') => ({
  filename: 'planta.png',
  contentType,
  bytes,
})

function setup() {
  return {
    repository: createFakeContentStore({
      projects: [{ id: 'project-1', ownerId: 'user-1' }, { id: 'project-2', ownerId: 'user-2' }],
      tasks: [{ id: 'task-1', projectId: 'project-1' }],
    }),
    storage: createMemoryStorage(),
  }
}

describe('anexos', () => {
  it('grava objeto e linha vinculados ao projeto do dono', async () => {
    const { repository, storage } = setup()

    const result = await createAttachment(repository, storage, 'user-1', { projectId: 'project-1' }, upload(), limits)

    expect(result.kind).toBe('created')
    if (result.kind !== 'created') return
    expect(result.attachment.sizeBytes).toBe(3)
    expect(result.attachment.storageKey.startsWith('user-1/')).toBe(true)
    expect(storage.entries.has(result.attachment.storageKey)).toBe(true)
  })

  it('aceita vínculo por card do dono', async () => {
    const { repository, storage } = setup()

    const result = await createAttachment(repository, storage, 'user-1', { taskId: 'task-1' }, upload(), limits)

    expect(result.kind).toBe('created')
  })

  it('exige projeto ou card', async () => {
    const { repository, storage } = setup()

    const result = await createAttachment(repository, storage, 'user-1', {}, upload(), limits)

    expect(result.kind).toBe('invalid')
    expect(storage.entries.size).toBe(0)
  })

  it('não deixa anexar em projeto de outro dono', async () => {
    const { repository, storage } = setup()

    const result = await createAttachment(repository, storage, 'user-1', { projectId: 'project-2' }, upload(), limits)

    expect(result.kind).toBe('target-not-found')
    expect(storage.entries.size).toBe(0)
  })

  it('recusa arquivo acima do limite e tipo fora da lista', async () => {
    const { repository, storage } = setup()

    const tooLarge = await createAttachment(
      repository, storage, 'user-1', { projectId: 'project-1' }, upload(new Uint8Array(2048)), limits,
    )
    const unsupported = await createAttachment(
      repository, storage, 'user-1', { projectId: 'project-1' }, upload(new Uint8Array([1]), 'application/x-msdownload'), limits,
    )

    expect(tooLarge.kind).toBe('too-large')
    expect(unsupported.kind).toBe('unsupported-type')
    expect(storage.entries.size).toBe(0)
  })

  it('aceita áudio para a etapa de transcrição', async () => {
    const { repository, storage } = setup()

    const result = await createAttachment(
      repository, storage, 'user-1', { projectId: 'project-1' }, upload(new Uint8Array([1]), 'audio/webm;codecs=opus'), limits,
    )

    expect(result.kind).toBe('created')
  })

  it('apaga o objeto quando a gravação da linha falha', async () => {
    const { repository, storage } = setup()
    repository.failCreateOnce(new Error('banco indisponível'))

    await expect(
      createAttachment(repository, storage, 'user-1', { projectId: 'project-1' }, upload(), limits),
    ).rejects.toThrow('banco indisponível')
    expect(storage.entries.size).toBe(0)
  })

  it('só entrega leitura ao dono', async () => {
    const { repository, storage } = setup()
    const created = await createAttachment(repository, storage, 'user-1', { projectId: 'project-1' }, upload(), limits)
    if (created.kind !== 'created') throw new Error('anexo não criado')

    await expect(readAttachment(repository, storage, 'user-2', created.attachment.id)).resolves.toBeNull()
    const found = await readAttachment(repository, storage, 'user-1', created.attachment.id)
    expect(found?.bytes).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('remove linha e objeto ao excluir', async () => {
    const { repository, storage } = setup()
    const created = await createAttachment(repository, storage, 'user-1', { projectId: 'project-1' }, upload(), limits)
    if (created.kind !== 'created') throw new Error('anexo não criado')

    await expect(deleteAttachment(repository, storage, 'user-2', created.attachment.id)).resolves.toBeNull()
    await expect(deleteAttachment(repository, storage, 'user-1', created.attachment.id)).resolves.toMatchObject({
      id: created.attachment.id,
    })
    expect(repository.attachments).toHaveLength(0)
    expect(storage.entries.size).toBe(0)
  })
})
