import { describe, expect, it, vi } from 'vitest'
import { createNote, listNotes, removeNote, updateNote } from './notes'

const include = { convertedTask: { select: { id: true } } }

describe('notas privadas persistidas', () => {
  it('lista notas do dono na ordem das posições, que é a ordem do arraste', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listNotes({ note: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { position: 'asc' },
      include,
    })
  })

  it('exige projeto do dono antes de gravar', async () => {
    const create = vi.fn()
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { findFirst: vi.fn() },
      note: { create },
    }

    const result = await createNote(repo, 'user-1', { projectId: 'project-de-outro', content: 'Texto' })

    expect(result).toEqual({ kind: 'project-not-found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejeita nota sem conteúdo antes de consultar o projeto', async () => {
    const repo = {
      project: { findFirst: vi.fn() },
      task: { findFirst: vi.fn() },
      note: { create: vi.fn() },
    }

    const result = await createNote(repo, 'user-1', { projectId: 'project-1', content: '   ' })

    expect(result.kind).toBe('invalid')
    expect(repo.project.findFirst).not.toHaveBeenCalled()
  })

  it('nota sem título recebe o começo do conteúdo', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'note-1' })
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-1' }) },
      task: { findFirst: vi.fn() },
      note: { create },
    }

    await createNote(repo, 'user-1', { projectId: 'project-1', content: '  Conferir camadas do mapa.  ' })

    expect(create.mock.calls[0]![0].data).toMatchObject({
      ownerId: 'user-1',
      projectId: 'project-1',
      title: 'Conferir camadas do mapa.',
      content: 'Conferir camadas do mapa.',
      taskId: null,
    })
  })

  it('descarta card de outro projeto em vez de recusar a nota', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'note-1' })
    const findFirst = vi.fn().mockResolvedValue(null)
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-1' }) },
      task: { findFirst },
      note: { create },
    }

    const result = await createNote(repo, 'user-1', {
      projectId: 'project-1',
      content: 'Texto',
      taskId: 'task-de-outro-projeto',
    })

    expect(result.kind).toBe('created')
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'task-de-outro-projeto', projectId: 'project-1' },
      select: { id: true },
    })
    expect(create.mock.calls[0]![0].data.taskId).toBeNull()
  })
})

describe('edição e remoção de nota', () => {
  const repository = (note: { id: string; projectId: string } | null, task: { id: string } | null = null) => ({
    task: { findFirst: vi.fn().mockResolvedValue(task) },
    note: {
      findFirst: vi.fn().mockResolvedValue(note),
      update: vi.fn().mockResolvedValue({ id: 'note-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'note-1' }),
    },
  })

  it('recusa nota de outro dono antes de gravar', async () => {
    const repo = repository(null)

    const result = await updateNote(repo, 'user-1', 'note-de-outro', { content: 'Sequestrada' })

    expect(result).toEqual({ kind: 'not-found' })
    expect(repo.note.update).not.toHaveBeenCalled()
  })

  it('grava fixação e posição sem tocar em conteúdo nem vínculo', async () => {
    const repo = repository({ id: 'note-1', projectId: 'project-1' })

    await updateNote(repo, 'user-1', 'note-1', { pinned: true, position: 0.5 })

    expect(repo.note.update.mock.calls[0]![0].data).toEqual({ pinned: true, position: 0.5 })
    expect(repo.task.findFirst).not.toHaveBeenCalled()
  })

  it('taskId nulo desfaz o vínculo com o card', async () => {
    const repo = repository({ id: 'note-1', projectId: 'project-1' })

    await updateNote(repo, 'user-1', 'note-1', { taskId: null })

    expect(repo.note.update.mock.calls[0]![0].data.taskId).toBeNull()
    expect(repo.task.findFirst).not.toHaveBeenCalled()
  })

  it('mantém vínculo com card do mesmo projeto', async () => {
    const repo = repository({ id: 'note-1', projectId: 'project-1' }, { id: 'task-1' })

    await updateNote(repo, 'user-1', 'note-1', { taskId: 'task-1' })

    expect(repo.note.update.mock.calls[0]![0].data.taskId).toBe('task-1')
  })

  it('remove só nota do próprio dono', async () => {
    const alheia = repository(null)
    const propria = repository({ id: 'note-1', projectId: 'project-1' })

    expect(await removeNote(alheia, 'user-1', 'note-de-outro')).toEqual({ kind: 'not-found' })
    expect(alheia.note.delete).not.toHaveBeenCalled()
    expect(await removeNote(propria, 'user-1', 'note-1')).toEqual({ kind: 'removed' })
    expect(propria.note.delete).toHaveBeenCalledWith({ where: { id: 'note-1' } })
  })
})
