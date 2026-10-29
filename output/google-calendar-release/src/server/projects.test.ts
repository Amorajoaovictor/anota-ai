import { describe, expect, it, vi } from 'vitest'
import { createProject, listProjects, updateProject } from './projects'

const include = { aliases: true, modules: true, tags: true, _count: { select: { tasks: true, milestones: true } } }

describe('projetos persistidos', () => {
  it('lista somente projetos do dono autenticado com dados necessários para as telas', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listProjects({ project: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
      include,
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
      include,
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

describe('edição de projeto persistido', () => {
  const repository = (
    owned: { id: string } | null,
    removable: { name: string }[] = [],
    removableTags: { name: string }[] = [],
  ) => ({
    project: {
      findFirst: vi.fn().mockResolvedValue(owned),
      update: vi.fn().mockResolvedValue({ id: 'project-1' }),
    },
    projectModule: { findMany: vi.fn().mockResolvedValue(removable) },
    projectTag: { findMany: vi.fn().mockResolvedValue(removableTags) },
  })

  it('recusa projeto de outro dono antes de gravar', async () => {
    const repo = repository(null)

    const result = await updateProject(repo, 'user-1', 'project-de-outro', { name: 'Sequestrado' })

    expect(result).toEqual({ kind: 'not-found' })
    expect(repo.project.update).not.toHaveBeenCalled()
  })

  it('arquiva pelo status em vez de apagar o projeto', async () => {
    const repo = repository({ id: 'project-1' })

    await updateProject(repo, 'user-1', 'project-1', { archived: true })

    expect(repo.project.update.mock.calls[0]![0].data).toEqual({ status: 'ARCHIVED' })
  })

  it('trata aliases e módulos como conjunto e preserva módulo com card vinculado', async () => {
    // Só "Legado" está livre; "Antigo" continua vinculado a um card e não aparece aqui.
    const repo = repository({ id: 'project-1' }, [{ name: 'Legado' }])

    await updateProject(repo, 'user-1', 'project-1', { aliases: ['PAX', 'pax'], modules: ['Mapa'] })

    expect(repo.projectModule.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', name: { notIn: ['Mapa'] }, tasks: { none: {} } },
      select: { name: true },
    })
    const { data } = repo.project.update.mock.calls[0]![0]
    // "pax" repete "PAX" só no caixa: entra uma vez só.
    expect(data.aliases).toEqual({ deleteMany: {}, create: [{ value: 'PAX' }] })
    expect(data.modules.deleteMany).toEqual({ name: { in: ['Legado'] } })
    expect(data.modules.upsert).toEqual([{
      where: { projectId_name: { projectId: 'project-1', name: 'Mapa' } },
      create: { name: 'Mapa' },
      update: {},
    }])
  })

  it('preserva etiqueta em uso por um card mesmo que ela saia da lista', async () => {
    // "obsoleta" está livre; "raster" continua em um card e por isso não aparece aqui.
    const repo = repository({ id: 'project-1' }, [], [{ name: 'obsoleta' }])

    await updateProject(repo, 'user-1', 'project-1', { tags: [{ name: 'CEGEO' }, { name: 'cegeo' }] })

    expect(repo.projectTag.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', name: { notIn: ['CEGEO'] }, tasks: { none: {} } },
      select: { name: true },
    })
    const { data } = repo.project.update.mock.calls[0]![0]
    expect(data.tags.deleteMany).toEqual({ name: { in: ['obsoleta'] } })
    // "cegeo" repete "CEGEO" só no caixa: entra uma vez, com a primeira grafia.
    expect(data.tags.upsert).toEqual([{
      where: { projectId_name: { projectId: 'project-1', name: 'CEGEO' } },
      create: { name: 'CEGEO' },
      update: {},
    }])
  })

  it('só troca a cor da etiqueta quando a tela informa uma', async () => {
    const repo = repository({ id: 'project-1' })

    await updateProject(repo, 'user-1', 'project-1', { tags: [{ name: 'raster', color: '#f0ad5b' }] })

    expect(repo.project.update.mock.calls[0]![0].data.tags.upsert).toEqual([{
      where: { projectId_name: { projectId: 'project-1', name: 'raster' } },
      create: { name: 'raster', color: '#f0ad5b' },
      update: { color: '#f0ad5b' },
    }])
  })

  it('recusa cor de etiqueta fora do hexadecimal de seis dígitos', async () => {
    const repo = repository({ id: 'project-1' })

    const result = await updateProject(repo, 'user-1', 'project-1', { tags: [{ name: 'raster', color: 'verde' }] })

    expect(result.kind).toBe('invalid')
    expect(repo.project.update).not.toHaveBeenCalled()
  })

  it('traduz nome já usado por outro projeto do mesmo dono', async () => {
    const repo = repository({ id: 'project-1' })
    repo.project.update.mockRejectedValue({ code: 'P2002' })

    const result = await updateProject(repo, 'user-1', 'project-1', { name: 'Intranet' })

    expect(result).toEqual({ kind: 'duplicate' })
  })
})
