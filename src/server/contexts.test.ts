import { describe, expect, it, vi } from 'vitest'
import { createContext, listContexts, removeContext, updateContext } from './contexts'

describe('contextos de projeto persistidos', () => {
  it('lista contextos de projetos do dono, do mais recente para o mais antigo', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listContexts({ projectContext: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { project: { ownerId: 'user-1' } },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('exige título e conteúdo: contexto sem afirmação não classifica nada', async () => {
    const repo = {
      project: { findFirst: vi.fn() },
      task: { findFirst: vi.fn() },
      projectContext: { create: vi.fn() },
    }

    const semTitulo = await createContext(repo, 'user-1', { projectId: 'project-1', title: '  ', content: 'Texto' })
    const semConteudo = await createContext(repo, 'user-1', { projectId: 'project-1', title: 'Regra', content: '  ' })

    expect(semTitulo.kind).toBe('invalid')
    expect(semConteudo.kind).toBe('invalid')
    expect(repo.project.findFirst).not.toHaveBeenCalled()
  })

  it('recusa projeto de outro dono', async () => {
    const create = vi.fn()
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { findFirst: vi.fn() },
      projectContext: { create },
    }

    const result = await createContext(repo, 'user-1', {
      projectId: 'project-de-outro',
      title: 'Regra',
      content: 'Texto',
    })

    expect(result).toEqual({ kind: 'project-not-found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('grava vínculo com card do mesmo projeto e descarta o de fora', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'context-1' })
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-1' }) },
      task: { findFirst: vi.fn().mockResolvedValue(null) },
      projectContext: { create },
    }

    const result = await createContext(repo, 'user-1', {
      projectId: 'project-1',
      title: '  Medidas passam pela CEGEO  ',
      content: '  Regra combinada.  ',
      taskId: 'task-de-outro-projeto',
    })

    expect(result.kind).toBe('created')
    expect(create.mock.calls[0]![0].data).toEqual({
      projectId: 'project-1',
      taskId: null,
      title: 'Medidas passam pela CEGEO',
      content: 'Regra combinada.',
    })
  })
})

describe('edição e remoção de contexto', () => {
  const repository = (context: { id: string; projectId: string } | null, task: { id: string } | null = null) => ({
    task: { findFirst: vi.fn().mockResolvedValue(task) },
    projectContext: {
      findFirst: vi.fn().mockResolvedValue(context),
      update: vi.fn().mockResolvedValue({ id: 'context-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'context-1' }),
    },
  })

  it('recusa contexto de projeto alheio antes de gravar', async () => {
    const repo = repository(null)

    const result = await updateContext(repo, 'user-1', 'context-de-outro', { title: 'Sequestrado' })

    expect(result).toEqual({ kind: 'not-found' })
    expect(repo.projectContext.update).not.toHaveBeenCalled()
    expect(repo.projectContext.findFirst).toHaveBeenCalledWith({
      where: { id: 'context-de-outro', project: { ownerId: 'user-1' } },
      select: { id: true, projectId: true },
    })
  })

  it('patch sem taskId não mexe no vínculo existente', async () => {
    const repo = repository({ id: 'context-1', projectId: 'project-1' })

    await updateContext(repo, 'user-1', 'context-1', { content: 'Texto novo' })

    expect(repo.projectContext.update.mock.calls[0]![0].data).toEqual({ content: 'Texto novo' })
    expect(repo.task.findFirst).not.toHaveBeenCalled()
  })

  it('remove só contexto de projeto do dono', async () => {
    const alheio = repository(null)
    const proprio = repository({ id: 'context-1', projectId: 'project-1' })

    expect(await removeContext(alheio, 'user-1', 'context-de-outro')).toEqual({ kind: 'not-found' })
    expect(alheio.projectContext.delete).not.toHaveBeenCalled()
    expect(await removeContext(proprio, 'user-1', 'context-1')).toEqual({ kind: 'removed' })
    expect(proprio.projectContext.delete).toHaveBeenCalledWith({ where: { id: 'context-1' } })
  })
})
