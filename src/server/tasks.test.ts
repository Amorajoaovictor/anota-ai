import { describe, expect, it, vi } from 'vitest'
import { createTask, listTasks } from './tasks'

describe('cards persistidos', () => {
  it('lista cards somente de projetos pertencentes ao dono autenticado', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listTasks({ task: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { project: { ownerId: 'user-1' } },
      orderBy: { updatedAt: 'desc' },
      include: { project: true, module: true, milestones: { include: { milestone: true } } },
    })
  })

  it('cria card no Backlog com prioridade P3 e projeto do usuário', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1', title: 'Validar mapa' })

    const result = await createTask({ project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: '  Validar mapa  ',
      description: '  Conferir camadas.  ',
    })

    expect(result).toEqual({ kind: 'created', task: { id: 'task-1', title: 'Validar mapa' } })
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'project-1', ownerId: 'user-1' }, select: { id: true } })
    expect(create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        title: 'Validar mapa',
        description: 'Conferir camadas.',
        status: 'BACKLOG',
        priority: 'P3',
        kind: 'TASK',
      },
      include: { project: true, module: true, milestones: { include: { milestone: true } } },
    })
  })

  it('bloqueia card para projeto inexistente ou de outro usuário', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const create = vi.fn()

    const result = await createTask({ project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-de-outro-usuario',
      title: 'Tentar acessar dados alheios',
    })

    expect(result).toEqual({ kind: 'project-not-found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejeita título vazio antes de consultar ou gravar', async () => {
    const findFirst = vi.fn()
    const create = vi.fn()

    const result = await createTask({ project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: '   ',
    })

    expect(result.kind).toBe('invalid')
    expect(findFirst).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
