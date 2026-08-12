import { describe, expect, it, vi } from 'vitest'
import { captureInboxAudio, captureInboxText, confirmInboxItem, discardInboxItem, listInboxItems } from './inbox'
import { createFakeJobStore } from '../test/fake-prisma'

function fakeStorage(seed: Record<string, Uint8Array> = {}) {
  const files = { ...seed }
  return {
    files,
    put: vi.fn(async (key: string, bytes: Uint8Array) => { files[key] = bytes }),
    read: vi.fn(async (key: string) => files[key] ?? null),
    delete: vi.fn(async (key: string) => { delete files[key] }),
    list: vi.fn(async (prefix: string) => Object.keys(files).filter((key) => key.startsWith(prefix)).map((key) => ({ key, updatedAt: new Date() }))),
  }
}

describe('caixa de entrada persistida', () => {
  it('lista entradas do dono, da mais recente para a mais antiga', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listInboxItems({ inboxItem: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      include: { aiRuns: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    })
  })

  it('captura texto e enfileira a classificação', async () => {
    const store = createFakeJobStore()
    const create = vi.fn().mockResolvedValue({ id: 'inbox-1' })
    const repo = { ...store, inboxItem: { create } }

    const result = await captureInboxText(repo, 'user-1', { text: '  Ligar para a equipe do PAX  ' })

    expect(result).toEqual({ kind: 'created', inboxItem: { id: 'inbox-1' } })
    expect(create).toHaveBeenCalledWith({
      data: { ownerId: 'user-1', source: 'TEXT', status: 'RECEIVED', text: 'Ligar para a equipe do PAX' },
    })
    expect(store.jobs).toMatchObject([{ type: 'ai.classify', payload: { inboxItemId: 'inbox-1' } }])
  })

  it('recusa texto vazio sem tocar no banco', async () => {
    const store = createFakeJobStore()
    const create = vi.fn()
    const repo = { ...store, inboxItem: { create } }

    const result = await captureInboxText(repo, 'user-1', { text: '   ' })

    expect(result.kind).toBe('invalid')
    expect(create).not.toHaveBeenCalled()
  })

  it('captura áudio, grava no storage e enfileira a transcrição', async () => {
    const store = createFakeJobStore()
    const storage = fakeStorage()
    const create = vi.fn().mockResolvedValue({ id: 'inbox-2' })
    const repo = { ...store, inboxItem: { create } }

    const result = await captureInboxAudio(
      repo,
      storage,
      'user-1',
      { filename: 'nota.webm', contentType: 'audio/webm', bytes: new Uint8Array([1, 2, 3]) },
      { maxUploadBytes: 1024 },
    )

    expect(result).toEqual({ kind: 'created', inboxItem: { id: 'inbox-2' } })
    expect(storage.put).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]![0].data).toMatchObject({ ownerId: 'user-1', source: 'AUDIO', status: 'TRANSCRIBING' })
    expect(store.jobs).toMatchObject([{ type: 'audio.transcribe', payload: { inboxItemId: 'inbox-2', contentType: 'audio/webm' } }])
  })

  it('recusa áudio grande ou de tipo errado sem gravar no storage', async () => {
    const store = createFakeJobStore()
    const storage = fakeStorage()
    const repo = { ...store, inboxItem: { create: vi.fn() } }

    const grande = await captureInboxAudio(repo, storage, 'user-1',
      { filename: 'a.webm', contentType: 'audio/webm', bytes: new Uint8Array(10) }, { maxUploadBytes: 5 })
    const tipoErrado = await captureInboxAudio(repo, storage, 'user-1',
      { filename: 'a.pdf', contentType: 'application/pdf', bytes: new Uint8Array(10) }, { maxUploadBytes: 1024 })

    expect(grande).toEqual({ kind: 'too-large' })
    expect(tipoErrado).toEqual({ kind: 'unsupported-type' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('descarta entrada do dono e ignora id inexistente', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'inbox-1', status: 'DISCARDED' })
    const repo = { inboxItem: { findFirst: vi.fn().mockResolvedValue({ id: 'inbox-1' }), update } }
    const repoAlheio = { inboxItem: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } }

    const result = await discardInboxItem(repo, 'user-1', 'inbox-1')
    const result2 = await discardInboxItem(repoAlheio, 'user-1', 'inbox-de-outro')

    expect(result).toEqual({ kind: 'discarded', inboxItem: { id: 'inbox-1', status: 'DISCARDED' } })
    expect(update).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'DISCARDED' } })
    expect(result2).toEqual({ kind: 'not-found' })
  })
})

describe('confirmação de proposta da Revisão IA', () => {
  const links = () => ({
    milestone: { findMany: vi.fn().mockResolvedValue([]) },
    note: { findFirst: vi.fn() },
  })

  it('cria o card com sourceInboxId, cria a tag nova e marca a entrada como processada', async () => {
    // Mesmo mock atende as duas consultas: a própria de `confirmInboxItem` e a de
    // `createTask` validando `sourceInboxId` — ambas buscam a mesma entrada por id.
    const findFirst = vi.fn()
      .mockResolvedValue({ id: 'inbox-1', status: 'AWAITING_CONFIRMATION', suggestion: { project: 'VistaFor' } })
    const inboxUpdate = vi.fn().mockResolvedValue({ id: 'inbox-1', status: 'PROCESSED' })
    const projectFindFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const upsert = vi.fn().mockResolvedValue({ id: 'tag-1' })
    const taskCreate = vi.fn().mockResolvedValue({ id: 'task-1', title: 'Revisar mapa' })
    const repo = {
      ...links(),
      inboxItem: { findFirst, update: inboxUpdate },
      project: { findFirst: projectFindFirst },
      // `findMany` simula a confirmação de que a tag recém-upsertada existe dentro do projeto —
      // é a mesma checagem de posse que `createTask` já faz para `tagIds` comuns.
      projectTag: { findMany: vi.fn().mockResolvedValue([{ id: 'tag-1' }]), upsert },
      task: { create: taskCreate },
    }

    const result = await confirmInboxItem(repo, 'user-1', 'inbox-1', {
      projectId: 'project-1',
      title: 'Revisar mapa',
      tags: ['raster'],
    })

    expect(result.kind).toBe('confirmed')
    expect(upsert).toHaveBeenCalledWith({
      where: { projectId_name: { projectId: 'project-1', name: 'raster' } },
      create: { projectId: 'project-1', name: 'raster' },
      update: {},
      select: { id: true },
    })
    expect(taskCreate.mock.calls[0]![0].data).toMatchObject({
      status: 'BACKLOG',
      tags: { create: [{ tagId: 'tag-1' }] },
    })
    expect(taskCreate.mock.calls[0]![0].data.source).toEqual({ connect: { id: 'inbox-1' } })
    expect(inboxUpdate).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'PROCESSED' } })
  })

  it('confirmar duas vezes não duplica card: a segunda só devolve o estado atual', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'inbox-1', status: 'PROCESSED', suggestion: { project: 'VistaFor' } })
    const taskCreate = vi.fn()
    const repo = {
      ...links(),
      inboxItem: { findFirst, update: vi.fn() },
      project: { findFirst: vi.fn() },
      projectTag: { findMany: vi.fn(), upsert: vi.fn() },
      task: { create: taskCreate },
    }

    const result = await confirmInboxItem(repo, 'user-1', 'inbox-1', { projectId: 'project-1', title: 'Revisar mapa' })

    expect(result.kind).toBe('already-confirmed')
    expect(taskCreate).not.toHaveBeenCalled()
  })

  it('recusa confirmar entrada sem proposta ainda pronta', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'inbox-1', status: 'ANALYZING', suggestion: null })
    const repo = { ...links(), inboxItem: { findFirst, update: vi.fn() }, project: { findFirst: vi.fn() }, projectTag: { findMany: vi.fn(), upsert: vi.fn() }, task: { create: vi.fn() } }

    const result = await confirmInboxItem(repo, 'user-1', 'inbox-1', { projectId: 'project-1', title: 'X' })

    expect(result).toEqual({ kind: 'not-ready' })
  })

  it('recusa entrada de outro dono', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repo = { ...links(), inboxItem: { findFirst, update: vi.fn() }, project: { findFirst: vi.fn() }, projectTag: { findMany: vi.fn(), upsert: vi.fn() }, task: { create: vi.fn() } }

    const result = await confirmInboxItem(repo, 'user-1', 'inbox-de-outro', { projectId: 'project-1', title: 'X' })

    expect(result).toEqual({ kind: 'not-found' })
  })
})
