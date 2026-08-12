import { describe, expect, it, vi } from 'vitest'
import { executeApprovedAiPlan } from './plan-executor'

function action(entity: string, id: string, data: unknown, dependsOn: string[] = []) {
  return { id, entity, operation: 'create', dependsOn, confidence: 90, evidence: ['Trecho explícito.'], data }
}

function plan(actions: unknown[]) {
  return { summary: 'Plano extraído.', confidence: 90, evidence: ['Áudio transcrito.'], actions }
}

function repository(status = 'AWAITING_CONFIRMATION', ownedProject = true) {
  return {
    inboxItem: {
      findFirst: vi.fn().mockResolvedValue({ id: 'inbox-1', status, suggestion: {} }),
      updateMany: vi.fn().mockResolvedValue({ count: status === 'AWAITING_CONFIRMATION' ? 1 : 0 }),
      update: vi.fn().mockResolvedValue({ id: 'inbox-1', status: 'PROCESSED' }),
    },
    project: {
      findFirst: vi.fn().mockResolvedValue(ownedProject ? { id: 'project-1' } : null),
      create: vi.fn().mockResolvedValue({ id: 'project-new', name: 'Atlas' }),
    },
    projectAlias: { upsert: vi.fn().mockResolvedValue({ id: 'alias-1' }) },
    projectModule: { upsert: vi.fn().mockResolvedValue({ id: 'module-1' }) },
    projectTag: { upsert: vi.fn().mockResolvedValue({ id: 'tag-1' }), findMany: vi.fn().mockResolvedValue([]) },
    projectContext: { create: vi.fn().mockImplementation(({ data }) => ({ id: `context-${data.title}`, ...data })) },
    milestone: { create: vi.fn().mockResolvedValue({ id: 'milestone-1' }), findMany: vi.fn().mockResolvedValue([]) },
    note: { findFirst: vi.fn() },
    task: {
      findFirst: vi.fn().mockResolvedValue({ id: 'task-existing', projectId: 'project-1' }),
      create: vi.fn().mockImplementation(({ data }) => ({ id: `task-${data.title}`, projectId: 'project-1', ...data })),
    },
    taskDependency: { upsert: vi.fn().mockResolvedValue({}) },
  }
}

describe('execução de plano aprovado da IA', () => {
  it('cria vários contextos e tarefas da mesma entrada', async () => {
    const repo = repository()
    const result = await executeApprovedAiPlan(repo, 'user-1', 'inbox-1', plan([
      action('context', 'context-rule', { project: { existingId: 'project-1' }, category: 'RULE', title: 'Publicação', content: 'Publicar só após homologação.' }),
      action('context', 'context-vocab', { project: { existingId: 'project-1' }, category: 'VOCABULARY', title: 'PAX', content: 'PAX significa VistaFor.' }),
      action('task', 'task-one', { project: { existingId: 'project-1' }, title: 'Revisar deploy' }),
      action('task', 'task-two', { project: { existingId: 'project-1' }, title: 'Documentar homologação' }),
    ]))

    expect(result.kind).toBe('executed')
    expect(repo.projectContext.create).toHaveBeenCalledTimes(2)
    expect(repo.task.create).toHaveBeenCalledTimes(2)
    expect(repo.inboxItem.update).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'PROCESSED' } })
  })

  it('resolve projeto criado na mesma proposta antes de alias e contexto', async () => {
    const repo = repository()
    await executeApprovedAiPlan(repo, 'user-1', 'inbox-1', plan([
      action('context', 'context-1', { project: { actionId: 'project-new' }, category: 'FACT', title: 'Stack', content: 'Usa mapas vetoriais.' }, ['project-new']),
      action('alias', 'alias-1', { project: { actionId: 'project-new' }, value: 'ATLAS' }, ['project-new']),
      action('project', 'project-new', { name: 'Atlas' }),
    ]))

    expect(repo.project.create).toHaveBeenCalledOnce()
    expect(repo.projectAlias.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_value: { projectId: 'project-new', value: 'ATLAS' } },
    }))
    expect(repo.projectContext.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: 'project-new' }) }))
  })

  it('cria tags sugeridas dentro do projeto e vincula à tarefa', async () => {
    const repo = repository()
    repo.projectTag.findMany.mockResolvedValue([{ id: 'tag-1' }])

    await executeApprovedAiPlan(repo, 'user-1', 'inbox-1', plan([
      action('task', 'task-one', { project: { existingId: 'project-1' }, title: 'Revisar deploy', tags: ['deploy'] }),
    ]))

    expect(repo.projectTag.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_name: { projectId: 'project-1', name: 'deploy' } },
    }))
    expect(repo.task.create.mock.calls[0]![0].data.tags).toEqual({ create: [{ tagId: 'tag-1' }] })
  })

  it('recusa referência de projeto alheio antes de criar entidade', async () => {
    const repo = repository('AWAITING_CONFIRMATION', false)
    await expect(executeApprovedAiPlan(repo, 'user-1', 'inbox-1', plan([
      action('context', 'context-1', { project: { existingId: 'project-alheio' }, category: 'FACT', title: 'x', content: 'y' }),
    ]))).rejects.toThrow('Projeto não encontrado')
    expect(repo.projectContext.create).not.toHaveBeenCalled()
  })

  it('confirmar novamente não executa ações', async () => {
    const repo = repository('PROCESSED')
    const result = await executeApprovedAiPlan(repo, 'user-1', 'inbox-1', plan([action('project', 'p', { name: 'X' })]))
    expect(result.kind).toBe('already-executed')
    expect(repo.project.create).not.toHaveBeenCalled()
  })
})
