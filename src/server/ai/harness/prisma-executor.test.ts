import { describe, expect, it, vi } from 'vitest'
import { executeApprovedHarnessProposal, hashJson } from './executor'
import { createPrismaHarnessExecutionRepository } from './prisma-executor'

const base = (id: string, entity: string, dependsOn: string[], data: unknown, operation = 'CREATE') => ({
  id, topicIds: ['topic-1'], operation, entity, dependsOn, data,
  evidence: [{ topicId: 'topic-1', quote: id }], confidence: { type: 95, project: 95, dates: 90 }, duplicateCandidates: [],
})

const proposal = {
  schemaVersion: 1,
  summary: 'Todos os tipos',
  items: [
    base('project-1', 'PROJECT', [], { name: 'Projeto Novo' }),
    base('task-1', 'TASK', ['project-1'], { project: { localId: 'project-1' }, title: 'Tarefa 1', moduleName: 'API', tags: ['backend'] }),
    base('task-2', 'TASK', ['project-1'], { project: { localId: 'project-1' }, title: 'Tarefa 2' }),
    base('meeting-1', 'MEETING', ['project-1'], { project: { localId: 'project-1' }, title: 'Reunião', startsAt: '2026-08-03T10:00:00-03:00', durationMinutes: 60, timezone: 'America/Sao_Paulo' }),
    base('note-1', 'NOTE', ['project-1', 'task-1'], { project: { localId: 'project-1' }, task: { localId: 'task-1' }, title: 'Nota', content: 'Privada', private: true }),
    base('milestone-1', 'MILESTONE', ['project-1'], { project: { localId: 'project-1' }, name: 'Marco', targetAt: '2026-08-10T12:00:00-03:00' }),
    base('alias-1', 'ALIAS', ['project-1'], { project: { localId: 'project-1' }, value: 'Novo' }),
    base('module-1', 'MODULE', ['project-1'], { project: { localId: 'project-1' }, name: 'Web' }),
    base('tag-1', 'TAG', ['project-1'], { project: { localId: 'project-1' }, name: 'Urgente' }),
    base('context-1', 'CONTEXT', ['project-1', 'task-1'], { project: { localId: 'project-1' }, task: { localId: 'task-1' }, category: 'DECISION', title: 'Decisão', content: 'Usar adapter' }),
    base('dependency-1', 'DEPENDENCY', ['task-1', 'task-2'], { task: { localId: 'task-1' }, dependsOnTask: { localId: 'task-2' } }, 'LINK'),
    base('task-milestone-1', 'TASK_MILESTONE', ['task-1', 'milestone-1'], { task: { localId: 'task-1' }, milestone: { localId: 'milestone-1' } }, 'LINK'),
  ],
  unresolved: [],
}

function prismaFixture() {
  const calls: Array<{ model: string; data: any }> = []
  const origins: any[] = []
  const audits: any[] = []
  const approvals: any[] = [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }]
  const executions: any[] = []
  let sequence = 0
  const create = (model: string) => vi.fn(async ({ data }: any) => {
    calls.push({ model, data })
    return { id: `db-${model}-${++sequence}`, ...data }
  })
  const proposalItems = proposal.items.map((item, index) => ({ id: `db-item-${index + 1}`, localKey: item.id, selected: true }))
  const tx: any = {
    proposalRevision: {
      findFirst: vi.fn(async () => ({
        id: 'proposal-1', contentHash: hashJson(proposal), validatedPlan: proposal, markdownRevision: { id: 'markdown-1', contentHash: 'markdown-hash' },
        items: proposalItems,
        aiRun: { id: 'run-1', ownerId: 'owner-1', status: 'AWAITING_ENTITY_APPROVAL', version: 7, approvals },
      })),
      update: vi.fn(async () => ({})),
    },
    aiExecution: {
      findUnique: vi.fn(async ({ where }: any) => executions.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null),
      create: vi.fn(async ({ data }: any) => { const value = { id: 'execution-1', ...data }; executions.push(value); return value }),
      update: vi.fn(async ({ where, data }: any) => { Object.assign(executions.find((entry) => entry.id === where.id), data); return {} }),
    },
    aiApproval: { create: vi.fn(async ({ data }: any) => { approvals.push(data); return data }) },
    aiRun: { updateMany: vi.fn(async () => ({ count: 1 })) },
    project: { create: create('project'), findFirst: vi.fn() },
    task: { create: create('task'), findFirst: vi.fn() },
    meeting: { create: create('meeting') },
    note: { create: create('note') },
    milestone: { create: create('milestone'), findFirst: vi.fn() },
    projectAlias: { create: create('alias'), findFirst: vi.fn() },
    projectModule: { create: create('module'), upsert: create('module-upsert'), findFirst: vi.fn() },
    projectTag: { create: create('tag'), upsert: create('tag-upsert'), findFirst: vi.fn() },
    projectContext: { create: create('context'), findFirst: vi.fn() },
    taskDependency: { upsert: vi.fn(async ({ create: data }: any) => { calls.push({ model: 'dependency', data }); return data }) },
    taskMilestone: { upsert: vi.fn(async ({ create: data }: any) => { calls.push({ model: 'taskMilestone', data }); return data }) },
    entityOrigin: { create: vi.fn(async ({ data }: any) => { origins.push(data); return data }) },
    auditLog: { create: vi.fn(async ({ data }: any) => { audits.push(data); return data }) },
  }
  const prisma: any = { $transaction: vi.fn(async (callback: any) => callback(tx)) }
  return { prisma, tx, calls, origins, audits, approvals, executions }
}

describe('adapter Prisma do executor v2', () => {
  /**
   * Protege: todos os tipos strict possuem materialização Prisma e origem real.
   * Detecta: tipo sem adapter ou EntityOrigin usando localKey em vez de ProposalItem.id.
   * Impacto: proposta aprovada falha no meio ou fica sem rastreabilidade.
   */
  it('cria todos os tipos, aprova e audita na transação serializável', async () => {
    const fake = prismaFixture()
    const result = await executeApprovedHarnessProposal(createPrismaHarnessExecutionRepository(fake.prisma), {
      ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1',
      targetHash: hashJson(proposal), expectedRunVersion: 7,
    })

    expect(result.kind).toBe('executed')
    expect(fake.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 30_000,
    })
    expect(fake.calls.map((entry) => entry.model)).toEqual(expect.arrayContaining([
      'project', 'task', 'meeting', 'note', 'milestone', 'alias', 'module', 'tag', 'context', 'dependency', 'taskMilestone',
    ]))
    expect(fake.origins).toHaveLength(proposal.items.length)
    expect(fake.origins.map((origin) => origin.proposalItemId).sort()).toEqual(
      proposal.items.map((_, index) => `db-item-${index + 1}`).sort(),
    )
    expect(fake.audits).toHaveLength(proposal.items.length)
    expect(fake.approvals).toContainEqual(expect.objectContaining({ type: 'ENTITIES', targetId: 'proposal-1', targetHash: hashJson(proposal) }))
    expect(fake.tx.aiRun.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ ownerId: 'owner-1', status: 'AWAITING_ENTITY_APPROVAL', version: 7 }),
      data: { status: 'EXECUTING' },
    }))
    expect(fake.tx.aiRun.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ ownerId: 'owner-1', status: 'EXECUTING', version: 7 }),
      data: expect.objectContaining({ status: 'PROCESSED' }),
    }))
  })

  /**
   * Protege: owner faz parte da consulta de toda referência.
   * Detecta: task existente buscada apenas por ID.
   * Impacto: vínculo cruzado entre contas.
   */
  it('filtra referência por owner e tipo', async () => {
    const fake = prismaFixture()
    fake.tx.task.findFirst.mockResolvedValue({ id: 'task-existing', projectId: 'project-existing' })
    const repository = createPrismaHarnessExecutionRepository(fake.prisma)

    const found = await repository.transaction((transaction) => transaction.findReference('owner-1', { id: 'task-existing', expectedType: 'TASK' }))

    expect(found).toMatchObject({ id: 'task-existing', entityType: 'TASK' })
    expect(fake.tx.task.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'task-existing', project: { ownerId: 'owner-1' } } }))
  })

  /**
   * Protege: conflito serializável é repetido sobre snapshot limpo.
   * Detecta: P2034 devolvido como erro final para clique concorrente.
   * Impacto: usuário vê falha embora outra execução possa concluir.
   */
  it('repete transação em conflito concorrente', async () => {
    const fake = prismaFixture()
    fake.prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementation(async (callback: any) => callback(fake.tx))
    const repository = createPrismaHarnessExecutionRepository(fake.prisma)

    await expect(repository.transaction(async () => 'ok')).resolves.toBe('ok')
    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(2)
  })
})
