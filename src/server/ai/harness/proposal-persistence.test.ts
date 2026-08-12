import { describe, expect, it } from 'vitest'
import { appendUserProposalRevision } from './proposal-persistence'
import { hashJson } from './executor'

const project = {
  id: 'project-1', topicIds: ['topic-1'], operation: 'CREATE' as const, entity: 'PROJECT' as const, dependsOn: [],
  data: { name: 'Projeto Novo' }, evidence: [{ topicId: 'topic-1', quote: 'Projeto Novo' }],
  confidence: { type: 95 }, duplicateCandidates: [],
}
const task = {
  id: 'task-1', topicIds: ['topic-1'], operation: 'CREATE' as const, entity: 'TASK' as const, dependsOn: ['project-1'],
  data: { project: { localId: 'project-1' }, title: 'Criar tarefa' },
  evidence: [{ topicId: 'topic-1', quote: 'Criar tarefa' }], confidence: { type: 95, project: 95 }, duplicateCandidates: [],
}
const proposal = { schemaVersion: 1 as const, summary: 'Projeto e tarefa', items: [project, task], unresolved: [] }

function fakeRepository() {
  const run: any = { id: 'run-1', ownerId: 'owner-1', status: 'AWAITING_ENTITY_APPROVAL', version: 8, activeProposalRevisionId: 'proposal-1' }
  const revisions: any[] = [{
    id: 'proposal-1', aiRunId: 'run-1', version: 1, markdownRevisionId: 'markdown-1', retrievalSnapshotId: 'retrieval-1',
  }]
  const items: any[] = []
  const repository: any = {
    aiRun: {
      findFirst: async ({ where }: any) => run.id === where.id && run.ownerId === where.ownerId ? { ...run } : null,
      updateMany: async ({ where, data }: any) => {
        if (run.version !== where.version || run.status !== where.status) return { count: 0 }
        run.version += data.version.increment
        run.activeProposalRevisionId = data.activeProposalRevisionId
        return { count: 1 }
      },
    },
    proposalRevision: {
      findFirst: async ({ where }: any) => revisions.find((entry) => entry.id === where.id && entry.aiRunId === where.aiRunId) ?? null,
      create: async ({ data }: any) => { revisions.push(data); return data },
    },
    proposalItem: {
      create: async ({ data }: any) => { items.push(data); return data },
    },
  }
  repository.$transaction = async (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, run, revisions, items }
}

describe('Fase 7 - revisoes editaveis da proposta', () => {
  /**
   * Protege: edicao cria snapshot USER com hash, parent e selecao imutaveis.
   * Detecta: update in-place da proposta gerada pela IA.
   * Impacto: diff e aprovacao deixam de ser rastreaveis.
   */
  it('acrescenta revisao USER e ativa por versao otimista', async () => {
    const fake = fakeRepository()
    const result = await appendUserProposalRevision(fake.repository, 'owner-1', 'run-1', {
      expectedVersion: 8, proposal, selectedItemIds: ['project-1', 'task-1'],
    })

    expect(result).toMatchObject({ kind: 'created', revision: {
      parentRevisionId: 'proposal-1', version: 2, source: 'USER', contentHash: hashJson(proposal),
    } })
    expect(fake.run.version).toBe(9)
    expect(fake.items).toHaveLength(2)
    expect(fake.items.every((item) => item.selected)).toBe(true)
  })

  /**
   * Protege: item dependente nao pode ficar selecionado sem sua dependencia.
   * Detecta: checkbox removendo projeto antes da task.
   * Impacto: executor recebe grafo quebrado e pode falhar no meio.
   */
  it('rejeita selecao quebrada antes de escrever', async () => {
    const fake = fakeRepository()
    const result = await appendUserProposalRevision(fake.repository, 'owner-1', 'run-1', {
      expectedVersion: 8, proposal, selectedItemIds: ['task-1'],
    })
    expect(result).toMatchObject({ kind: 'invalid' })
    expect(fake.revisions).toHaveLength(1)
  })

  it('rejeita versao obsoleta e outro proprietario', async () => {
    const stale = fakeRepository()
    expect(await appendUserProposalRevision(stale.repository, 'owner-1', 'run-1', {
      expectedVersion: 7, proposal, selectedItemIds: ['project-1', 'task-1'],
    })).toEqual({ kind: 'stale-version' })

    const foreign = fakeRepository()
    expect(await appendUserProposalRevision(foreign.repository, 'owner-2', 'run-1', {
      expectedVersion: 8, proposal, selectedItemIds: ['project-1', 'task-1'],
    })).toEqual({ kind: 'not-found' })
  })
})
