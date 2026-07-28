import { describe, expect, it, vi } from 'vitest'
import { createTask, getTaskHistory, listTasks, updateTask } from './tasks'

const include = {
  project: true,
  module: true,
  milestones: { include: { milestone: true } },
  tags: { include: { tag: true } },
  dependsOn: true,
}

/** Marco, etiqueta e nota de origem são consultados antes de gravar o vínculo. */
const links = (milestones: { id: string }[] = [], tags: { id: string }[] = [], note: { id: string } | null = null) => ({
  milestone: { findMany: vi.fn().mockResolvedValue(milestones) },
  projectTag: { findMany: vi.fn().mockResolvedValue(tags) },
  note: { findFirst: vi.fn().mockResolvedValue(note) },
})

describe('cards persistidos', () => {
  it('lista cards somente de projetos pertencentes ao dono autenticado', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listTasks({ task: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { project: { ownerId: 'user-1' } },
      orderBy: { updatedAt: 'desc' },
      include,
    })
  })

  it('cria card no Backlog com prioridade P3 e projeto do usuário', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1', title: 'Validar mapa' })

    const result = await createTask({ ...links(), project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: '  Validar mapa  ',
      description: '  Conferir camadas.  ',
    })

    expect(result).toEqual({ kind: 'created', task: { id: 'task-1', title: 'Validar mapa' } })
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'project-1', ownerId: 'user-1' }, select: { id: true } })
    expect(create).toHaveBeenCalledWith({
      data: {
        project: { connect: { id: 'project-1' } },
        title: 'Validar mapa',
        description: 'Conferir camadas.',
        status: 'BACKLOG',
        priority: 'P3',
        kind: 'TASK',
      },
      include,
    })
  })

  it('bloqueia card para projeto inexistente ou de outro usuário', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const create = vi.fn()

    const result = await createTask({ ...links(), project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-de-outro-usuario',
      title: 'Tentar acessar dados alheios',
    })

    expect(result).toEqual({ kind: 'project-not-found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejeita título vazio antes de consultar ou gravar', async () => {
    const findFirst = vi.fn()
    const create = vi.fn()

    const result = await createTask({ ...links(), project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: '   ',
    })

    expect(result.kind).toBe('invalid')
    expect(findFirst).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('grava status, tipo, prioridade e prazo vindos da tela em vez dos defaults', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })

    await createTask({ ...links(), project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: 'Mover raster',
      moduleName: 'Mapa',
      status: 'IN_PROGRESS',
      kind: 'BUG',
      priority: 'P0',
      dueAt: '2026-07-30T00:00:00.000Z',
      complexity: 3,
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        project: { connect: { id: 'project-1' } },
        title: 'Mover raster',
        description: '',
        status: 'IN_PROGRESS',
        kind: 'BUG',
        priority: 'P0',
        dueAt: '2026-07-30T00:00:00.000Z',
        complexity: 3,
        module: {
          connectOrCreate: {
            where: { projectId_name: { projectId: 'project-1', name: 'Mapa' } },
            create: { name: 'Mapa', project: { connect: { id: 'project-1' } } },
          },
        },
      },
      include,
    })
  })

  it('grava previsão e descrição como campos distintos do prazo', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })

    await createTask({ ...links(), project: { findFirst }, task: { create } }, 'user-1', {
      projectId: 'project-1',
      title: 'Ajustar planta',
      description: 'Previsão vencida é alerta, não atraso.',
      dueAt: '2026-07-30T00:00:00.000Z',
      forecastAt: '2026-08-04T00:00:00.000Z',
    })

    expect(create.mock.calls[0]![0].data).toMatchObject({
      dueAt: '2026-07-30T00:00:00.000Z',
      forecastAt: '2026-08-04T00:00:00.000Z',
      description: 'Previsão vencida é alerta, não atraso.',
    })
  })

  it('vincula marco e etiqueta do projeto e descarta os de fora', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })
    const repo = { ...links([{ id: 'milestone-1' }], [{ id: 'tag-1' }]), project: { findFirst }, task: { create } }

    await createTask(repo, 'user-1', {
      projectId: 'project-1',
      title: 'Nascer vinculado',
      milestoneIds: ['milestone-1', 'milestone-de-outro-projeto'],
      tagIds: ['tag-1', 'tag-de-outro-projeto'],
    })

    expect(repo.milestone.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['milestone-1', 'milestone-de-outro-projeto'] }, projectId: 'project-1' },
      select: { id: true },
    })
    expect(create.mock.calls[0]![0].data).toMatchObject({
      milestones: { create: [{ milestoneId: 'milestone-1' }] },
      tags: { create: [{ tagId: 'tag-1' }] },
    })
  })

  it('não manda vínculo vazio para o Prisma quando a tela não escolheu nada', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })
    const repo = { ...links(), project: { findFirst }, task: { create } }

    await createTask(repo, 'user-1', { projectId: 'project-1', title: 'Sem vínculo', milestoneIds: [], tagIds: [] })

    expect(repo.milestone.findMany).not.toHaveBeenCalled()
    expect(create.mock.calls[0]![0].data.milestones).toBeUndefined()
    expect(create.mock.calls[0]![0].data.tags).toBeUndefined()
  })

  it('conecta a nota de origem só quando ela é do dono e ainda não virou card', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })
    const repo = { ...links([], [], { id: 'note-1' }), project: { findFirst }, task: { create } }

    await createTask(repo, 'user-1', { projectId: 'project-1', title: 'Da nota', sourceNoteId: 'note-1' })

    expect(repo.note.findFirst).toHaveBeenCalledWith({
      where: { id: 'note-1', ownerId: 'user-1', convertedTask: { is: null } },
      select: { id: true },
    })
    expect(create.mock.calls[0]![0].data.sourceNote).toEqual({ connect: { id: 'note-1' } })
  })

  it('ignora nota de origem já convertida em vez de estourar o índice único', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'project-1' })
    const create = vi.fn().mockResolvedValue({ id: 'task-1' })
    const repo = { ...links(), project: { findFirst }, task: { create } }

    const result = await createTask(repo, 'user-1', { projectId: 'project-1', title: 'Da nota', sourceNoteId: 'note-1' })

    expect(result.kind).toBe('created')
    expect(create.mock.calls[0]![0].data.sourceNote).toBeUndefined()
  })
})

describe('edição de card persistido', () => {
  const repository = (
    task: { id: string; projectId: string } | null,
    dependencies: { id: string }[] = [],
    linked: { milestones?: { id: string }[]; tags?: { id: string }[] } = {},
  ) => ({
    ...links(linked.milestones, linked.tags),
    task: {
      findFirst: vi.fn().mockResolvedValue(task),
      findMany: vi.fn().mockResolvedValue(dependencies),
      update: vi.fn().mockResolvedValue({ id: 'task-1' }),
    },
  })

  it('recusa card de outro dono antes de gravar', async () => {
    const repo = repository(null)

    const result = await updateTask(repo, 'user-1', 'task-de-outro', { title: 'Renomear' })

    expect(result).toEqual({ kind: 'not-found' })
    expect(repo.task.update).not.toHaveBeenCalled()
  })

  it('substitui o conjunto de dependências descartando alvo fora do projeto', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' }, [{ id: 'task-2' }])

    await updateTask(repo, 'user-1', 'task-1', { dependsOnIds: ['task-2', 'task-de-outro-projeto'] })

    expect(repo.task.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['task-2', 'task-de-outro-projeto'] }, projectId: 'project-1', project: { ownerId: 'user-1' } },
      select: { id: true },
    })
    expect(repo.task.update.mock.calls[0]![0].data.dependsOn).toEqual({
      deleteMany: {},
      create: [{ dependsOnId: 'task-2' }],
    })
  })

  it('descarta autorreferência sem consultar o banco', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' })

    await updateTask(repo, 'user-1', 'task-1', { dependsOnIds: ['task-1'] })

    expect(repo.task.findMany).not.toHaveBeenCalled()
    expect(repo.task.update.mock.calls[0]![0].data.dependsOn).toEqual({ deleteMany: {}, create: [] })
  })

  it('módulo vazio desliga o vínculo em vez de criar módulo sem nome', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' })

    await updateTask(repo, 'user-1', 'task-1', { moduleName: '' })

    expect(repo.task.update.mock.calls[0]![0].data.module).toEqual({ disconnect: true })
  })

  it('substitui etiquetas descartando as de outro projeto', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' }, [], { tags: [{ id: 'tag-1' }] })

    await updateTask(repo, 'user-1', 'task-1', { tagIds: ['tag-1', 'tag-de-outro-projeto'] })

    expect(repo.task.update.mock.calls[0]![0].data.tags).toEqual({
      deleteMany: {},
      create: [{ tagId: 'tag-1' }],
    })
  })

  it('lista vazia de marcos apaga todos os vínculos do card', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' })

    await updateTask(repo, 'user-1', 'task-1', { milestoneIds: [] })

    expect(repo.milestone.findMany).not.toHaveBeenCalled()
    expect(repo.task.update.mock.calls[0]![0].data.milestones).toEqual({ deleteMany: {}, create: [] })
  })

  it('não toca em etiqueta nem marco quando o patch não os menciona', async () => {
    const repo = repository({ id: 'task-1', projectId: 'project-1' })

    await updateTask(repo, 'user-1', 'task-1', { title: 'Só o título' })

    expect(repo.task.update.mock.calls[0]![0].data.tags).toBeUndefined()
    expect(repo.task.update.mock.calls[0]![0].data.milestones).toBeUndefined()
  })
})

describe('histórico do card', () => {
  it('lê a trilha de auditoria só depois de confirmar a posse', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'audit-1' }])
    const findFirst = vi.fn().mockResolvedValue({ id: 'task-1' })

    const history = await getTaskHistory({ task: { findFirst }, auditLog: { findMany } }, 'user-1', 'task-1')

    expect(history).toEqual([{ id: 'audit-1' }])
    expect(findMany).toHaveBeenCalledWith({
      where: { entityType: 'Task', entityId: 'task-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('devolve nulo para card de outro dono sem tocar na auditoria', async () => {
    const findMany = vi.fn()

    const history = await getTaskHistory(
      { task: { findFirst: vi.fn().mockResolvedValue(null) }, auditLog: { findMany } },
      'user-1',
      'task-de-outro',
    )

    expect(history).toBeNull()
    expect(findMany).not.toHaveBeenCalled()
  })
})
