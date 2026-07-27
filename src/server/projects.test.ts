import { describe, expect, it, vi } from 'vitest'
import { createProject, listProjects } from './projects'

describe('projetos persistidos', () => {
  it('lista somente projetos do dono autenticado com dados necessários para as telas', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listProjects({ project: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
      include: { aliases: true, modules: true, _count: { select: { tasks: true, milestones: true } } },
    })
  })

  it('cria projeto com dono, nome normalizado e valores padrão do domínio', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'project-1', name: 'Observa' })

    const result = await createProject({ project: { create } }, 'user-1', {
      name: '  Observa  ',
      description: '  Monitoramento ambiental.  ',
    })

    expect(result).toEqual({ kind: 'created', project: { id: 'project-1', name: 'Observa' } })
    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        name: 'Observa',
        description: 'Monitoramento ambiental.',
        color: '#68d7a7',
        priority: 'P3',
      },
      include: { aliases: true, modules: true, _count: { select: { tasks: true, milestones: true } } },
    })
  })

  it('rejeita nome vazio antes de gravar', async () => {
    const create = vi.fn()

    const result = await createProject({ project: { create } }, 'user-1', { name: '   ' })

    expect(result.kind).toBe('invalid')
    expect(create).not.toHaveBeenCalled()
  })

  it('traduz duplicidade do mesmo dono sem expor erro do banco', async () => {
    const create = vi.fn().mockRejectedValue({ code: 'P2002' })

    const result = await createProject({ project: { create } }, 'user-1', { name: 'Observa' })

    expect(result).toEqual({ kind: 'duplicate' })
  })
})
