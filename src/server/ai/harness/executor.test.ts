import { describe, expect, it } from 'vitest'
import { hashJson } from './executor'
import {
  InMemoryHarnessExecutionRepository,
  executeApprovedHarnessProposal,
  orderHarnessExecutionItems,
  processHarnessExecutionStep,
  startApprovedHarnessProposal,
  type HarnessExecutionContext,
} from './executor'

const proposal = {
  schemaVersion: 1 as const,
  summary: 'Criar projeto e tarefa',
  items: [
    {
      id: 'task-1', topicIds: ['topic-1'], operation: 'CREATE' as const, entity: 'TASK' as const, dependsOn: ['project-1'],
      data: { project: { localId: 'project-1' }, title: 'Criar tarefa' },
      evidence: [{ topicId: 'topic-1', quote: 'Criar tarefa' }], confidence: { type: 95, project: 95 }, duplicateCandidates: [],
    },
    {
      id: 'project-1', topicIds: ['topic-1'], operation: 'CREATE' as const, entity: 'PROJECT' as const, dependsOn: [],
      data: { name: 'Projeto Novo' }, evidence: [{ topicId: 'topic-1', quote: 'Projeto Novo' }],
      confidence: { type: 95 }, duplicateCandidates: [],
    },
  ],
  unresolved: [],
}

function context(overrides: Partial<HarnessExecutionContext> = {}): HarnessExecutionContext {
  const proposalHash = hashJson(proposal)
  return {
    ownerId: 'owner-1',
    run: { id: 'run-1', status: 'AWAITING_ENTITY_APPROVAL', version: 7 },
    markdownRevision: { id: 'markdown-1', contentHash: 'markdown-hash' },
    proposalRevision: { id: 'proposal-1', contentHash: proposalHash, validatedPlan: proposal, selectedItemIds: ['project-1', 'task-1'] },
    approvals: [
      { type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' },
      { type: 'ENTITIES', targetId: 'proposal-1', targetHash: proposalHash },
    ],
    ...overrides,
  }
}

const execute = (repository: InMemoryHarnessExecutionRepository) => executeApprovedHarnessProposal(repository, {
  ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1', expectedRunVersion: 7,
})

const approveAndExecute = (repository: InMemoryHarnessExecutionRepository, targetHash: string) => executeApprovedHarnessProposal(repository, {
  ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1', targetHash, expectedRunVersion: 7,
})

describe('Fase 7 — executor transacional', () => {
  /**
   * Protege H01: nenhuma escrita sem as duas aprovações exatas.
   * Detecta: executor aceitando somente estado ou uma aprovação.
   * Impacto: criação antes da revisão humana final.
   */
  it('bloqueia execução sem aprovação exata da proposta', async () => {
    const value = context({ approvals: [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }] })
    const repository = new InMemoryHarnessExecutionRepository([value])

    await expect(execute(repository)).resolves.toMatchObject({ kind: 'blocked', code: 'APPROVAL_REQUIRED' })
    expect(repository.snapshot().entities).toHaveLength(0)
  })

  /**
   * Protege: aprovação 2 e criação confirmam na mesma transação.
   * Detecta: approval persistida antes de falha ou hash diferente do preview.
   * Impacto: estado aprovado sem entidades ou execução de revisão obsoleta.
   */
  it('cria aprovação ENTITIES exata junto da execução', async () => {
    const value = context({ approvals: [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }] })
    const repository = new InMemoryHarnessExecutionRepository([value])

    await expect(approveAndExecute(repository, value.proposalRevision.contentHash)).resolves.toMatchObject({ kind: 'executed' })
    expect(repository.snapshot().approvals).toContainEqual({
      type: 'ENTITIES', targetId: 'proposal-1', targetHash: value.proposalRevision.contentHash,
    })
  })

  it('reverte aprovação ENTITIES quando criação falha e rejeita hash divergente', async () => {
    const value = context({ approvals: [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }] })
    const failed = new InMemoryHarnessExecutionRepository([value], { failOnItemId: 'task-1' })
    await expect(approveAndExecute(failed, value.proposalRevision.contentHash)).resolves.toMatchObject({ kind: 'failed' })
    expect(failed.snapshot().approvals).toEqual(value.approvals)

    const mismatch = new InMemoryHarnessExecutionRepository([value])
    await expect(approveAndExecute(mismatch, 'hash-obsoleto')).resolves.toMatchObject({ kind: 'blocked', code: 'APPROVAL_MISMATCH' })
    expect(mismatch.snapshot().entities).toHaveLength(0)
  })

  /**
   * Protege: aprovação 2 corresponde também à seleção persistida na revisão exibida.
   * Detecta: clique de aba obsoleta executando seleção diferente da salva pelo autosave.
   * Impacto: entidades marcadas ou removidas pelo usuário podem ser criadas incorretamente.
   */
  it('rejeita seleção do cliente diferente da revisão persistida', async () => {
    const value = context({ approvals: [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }] })
    const repository = new InMemoryHarnessExecutionRepository([value])

    const result = await executeApprovedHarnessProposal(repository, {
      ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1',
      targetHash: value.proposalRevision.contentHash, selectedItemIds: ['task-1'], expectedRunVersion: 7,
    })

    expect(result).toMatchObject({ kind: 'blocked', code: 'APPROVAL_MISMATCH' })
    expect(repository.snapshot().entities).toHaveLength(0)
  })

  /**
   * Protege H06: chamadas concorrentes usam uma chave idempotente.
   * Detecta: duas transações criando entidades para mesma proposta.
   * Impacto: dados duplicados por clique ou worker repetido.
   */
  it('executa uma vez sob concorrência e devolve mesmos IDs', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()])

    const [first, second] = await Promise.all([execute(repository), execute(repository)])

    expect(first.kind).toBe('executed')
    expect(second.kind).toBe('already-executed')
    expect(first.executionId).toBe(second.executionId)
    expect(repository.snapshot().executions).toHaveLength(1)
    expect(repository.snapshot().entities).toHaveLength(2)
  })

  it('aprova e executa uma vez quando dois cliques chegam sem aprovação 2 prévia', async () => {
    const value = context({ approvals: [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' }] })
    const repository = new InMemoryHarnessExecutionRepository([value])

    const [first, second] = await Promise.all([
      approveAndExecute(repository, value.proposalRevision.contentHash),
      approveAndExecute(repository, value.proposalRevision.contentHash),
    ])

    expect([first.kind, second.kind].sort()).toEqual(['already-executed', 'executed'])
    expect(repository.snapshot().approvals.filter((approval) => approval.type === 'ENTITIES')).toHaveLength(1)
    expect(repository.snapshot().executions).toHaveLength(1)
  })

  it('não revela execução idempotente para outro proprietário', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()])
    await execute(repository)

    const foreign = await executeApprovedHarnessProposal(repository, {
      ownerId: 'owner-2', aiRunId: 'run-1', proposalRevisionId: 'proposal-1', expectedRunVersion: 7,
    })

    expect(foreign).toEqual({ kind: 'not-found' })
  })

  /**
   * Protege H07: falha intermediária reverte toda escrita.
   * Detecta: entidade ou claim persistido fora da transação.
   * Impacto: base fica pela metade e não corresponde ao preview.
   */
  it('reverte claim, entidades, origem e auditoria quando item falha', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()], { failOnItemId: 'task-1' })

    await expect(execute(repository)).resolves.toMatchObject({ kind: 'failed', code: 'EXECUTION_FAILED' })
    expect(repository.snapshot()).toMatchObject({ executions: [], entities: [], origins: [], audits: [] })
    expect(repository.getRunStatus('run-1')).toBe('AWAITING_ENTITY_APPROVAL')
  })

  /**
   * Protege H17: referência existente é revalidada dentro da transação.
   * Detecta: confiança exclusiva no preview/snapshot antigo.
   * Impacto: relação inválida ou acesso fora do proprietário.
   */
  it('bloqueia tudo quando referência foi removida depois do preview', async () => {
    const existingProposal = {
      ...proposal,
      items: [{ ...proposal.items[0], dependsOn: [], data: { project: { existingId: 'project-existing' }, title: 'Criar tarefa' } }],
    }
    const value = context({
      proposalRevision: {
        id: 'proposal-1', contentHash: hashJson(existingProposal), validatedPlan: existingProposal,
        selectedItemIds: ['task-1'],
      },
      approvals: [
        { type: 'MARKDOWN', targetId: 'markdown-1', targetHash: 'markdown-hash' },
        { type: 'ENTITIES', targetId: 'proposal-1', targetHash: hashJson(existingProposal) },
      ],
    })
    const repository = new InMemoryHarnessExecutionRepository([value], {
      references: [{ id: 'project-existing', ownerId: 'owner-1', entityType: 'PROJECT' }],
    })
    repository.removeReference('project-existing')

    await expect(execute(repository)).resolves.toMatchObject({ kind: 'blocked', code: 'REFERENCE_STALE' })
    expect(repository.snapshot().entities).toHaveLength(0)
  })

  /**
   * Protege H19/H20: ordem topológica, origem e auditoria confirmam juntas.
   * Detecta: ordem errada ou rastreabilidade gravada depois da entidade.
   * Impacto: FK quebrada ou entidade sem origem comprovável.
   */
  it('cria em ordem topológica com origem e auditoria sanitizada', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()])

    const result = await execute(repository)
    const state = repository.snapshot()

    expect(result.kind).toBe('executed')
    expect(state.entities.map((entity) => entity.proposalItemId)).toEqual(['project-1', 'task-1'])
    expect(state.origins).toHaveLength(2)
    expect(state.audits).toHaveLength(2)
    expect(state.audits.every((audit) => !('content' in audit.metadata) && !('data' in audit.metadata))).toBe(true)
    expect(repository.getRunStatus('run-1')).toBe('PROCESSED')
  })

  it('reverte entidade e origem quando auditoria falha', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()], { failOnAuditItemId: 'task-1' })

    await expect(execute(repository)).resolves.toMatchObject({ kind: 'failed', code: 'EXECUTION_FAILED' })
    expect(repository.snapshot()).toMatchObject({ executions: [], entities: [], origins: [], audits: [] })
  })

  it('rejeita seleção que remove dependência antes de escrever', async () => {
    const value = context({
      proposalRevision: { id: 'proposal-1', contentHash: hashJson(proposal), validatedPlan: proposal, selectedItemIds: ['task-1'] },
    })
    const repository = new InMemoryHarnessExecutionRepository([value])

    await expect(execute(repository)).resolves.toMatchObject({ kind: 'blocked', code: 'INVALID_GRAPH' })
    expect(repository.snapshot().entities).toHaveLength(0)
  })

  /**
   * Protege: projeto nasce antes de tasks e contextos, mesmo quando proposta
   * veio com contexto antes no array.
   * Detecta: worker processando ordem textual e tentando criar contexto antes
   * do projeto/tarefa referenciado.
   * Impacto: FK quebrada ou contexto criado antes da estrutura que usuário aprovou.
   */
  it('ordena execução por fases sem quebrar dependências', () => {
    const phased = {
      ...proposal,
      items: [
        { ...proposal.items[0], id: 'context-1', entity: 'CONTEXT' as const, dependsOn: ['task-1'], data: { project: { localId: 'project-1' }, task: { localId: 'task-1' }, category: 'FACT' as const, title: 'Contexto', content: 'Conteúdo' } },
        { ...proposal.items[0], id: 'task-1', entity: 'TASK' as const, dependsOn: ['project-1'], data: { project: { localId: 'project-1' }, title: 'Task' } },
        { ...proposal.items[1], id: 'project-1', entity: 'PROJECT' as const, dependsOn: [], data: { name: 'Projeto' } },
      ],
    }

    expect(orderHarnessExecutionItems(phased, ['context-1', 'task-1', 'project-1']).map((item) => item.id))
      .toEqual(['project-1', 'task-1', 'context-1'])
  })

  /**
   * Protege: execução grande usa uma transação curta por item e retoma no
   * próximo item, mantendo projeto -> task -> conclusão.
   * Detecta: POST síncrono tentando criar toda proposta numa transação única.
   * Impacto: P2028/500 em propostas reais e execução sem retomada.
   */
  it('inicia job por item, retoma e não duplica item já confirmado', async () => {
    const repository = new InMemoryHarnessExecutionRepository([context()])
    const started = await startApprovedHarnessProposal(repository, {
      ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1',
      targetHash: context().proposalRevision.contentHash, selectedItemIds: ['task-1', 'project-1'], expectedRunVersion: 7,
    })

    expect(started).toMatchObject({ kind: 'started', executionId: 'execution-1' })
    const firstJob = repository.snapshot().queuedSteps[0]!
    expect(firstJob.orderedItemIds).toEqual(['project-1', 'task-1'])

    await expect(processHarnessExecutionStep(repository, firstJob)).resolves.toMatchObject({ kind: 'progress' })
    await expect(processHarnessExecutionStep(repository, firstJob)).resolves.toMatchObject({ kind: 'progress' })
    expect(repository.snapshot().entities).toHaveLength(1)
    expect(repository.snapshot().queuedSteps).toHaveLength(2)

    const secondJob = repository.snapshot().queuedSteps[1]!
    await expect(processHarnessExecutionStep(repository, secondJob)).resolves.toMatchObject({ kind: 'completed' })
    expect(repository.snapshot().entities).toHaveLength(2)
    expect(repository.getRunStatus('run-1')).toBe('PROCESSED')
  })
})
