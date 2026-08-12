import { describe, expect, it, vi } from 'vitest'
import { processMaterializationJob, processRetrievalJob } from './pipeline'
import { hashMarkdown } from './hash'

function fakeRepository() {
  const markdown = {
    id: 'markdown-1', aiRunId: 'run-1', content: '## Tarefa\nCriar prototipo.', contentHash: hashMarkdown('## Tarefa\nCriar prototipo.'),
    topics: [{ id: 'topic-1', title: 'Tarefa', order: 0 }],
  }
  const run: any = { id: 'run-1', ownerId: 'owner-1', status: 'RETRIEVING_REFERENCES', version: 5, discardedAt: null }
  const approvals = [{ type: 'MARKDOWN', targetId: 'markdown-1', targetHash: markdown.contentHash }]
  const retrievals: any[] = []
  const proposals: any[] = []
  const items: any[] = []
  const attempts: any[] = []
  const jobs: any[] = []
  const repository: any = {
    aiRun: {
      findFirst: async ({ where }: any) => run.id === where.id && run.ownerId === where.ownerId ? { ...run } : null,
      updateMany: async ({ where, data }: any) => {
        if (run.id !== where.id || run.ownerId !== where.ownerId || run.version !== where.version || run.status !== where.status || run.discardedAt) return { count: 0 }
        run.version += data.version.increment
        run.status = data.status
        Object.assign(run, data)
        run.version = where.version + 1
        return { count: 1 }
      },
    },
    markdownRevision: { findFirst: async ({ where }: any) => markdown.id === where.id && markdown.aiRunId === where.aiRunId ? markdown : null },
    aiApproval: { findFirst: async ({ where }: any) => approvals.find((entry) => entry.type === where.type && entry.targetId === where.targetId) ?? null },
    retrievalSnapshot: {
      findFirst: async ({ where }: any) => retrievals.find((entry) => entry.id === where.id && entry.aiRunId === where.aiRunId) ?? null,
      create: async ({ data }: any) => { retrievals.push(data); return data },
    },
    proposalRevision: { create: async ({ data }: any) => { proposals.push(data); return data } },
    proposalItem: { create: async ({ data }: any) => { items.push(data); return data } },
    aiCallAttempt: {
      findFirst: async ({ where }: any) => attempts
        .filter((entry) => entry.aiRunId === where.aiRunId && entry.step === where.step)
        .sort((left, right) => right.attempt - left.attempt)[0] ?? null,
      create: async ({ data }: any) => { attempts.push(data); return data },
    },
    job: {
      create: async ({ data }: any) => { const value = { id: `job-${jobs.length + 1}`, ...data }; jobs.push(value); return value },
      findUnique: async () => null,
    },
  }
  repository.$transaction = async (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, run, markdown, retrievals, proposals, items, attempts, jobs }
}

const retrievalJob = (inputHash: string): any => ({
  id: 'job-retrieve', type: 'ai.retrieve', payload: { markdownRevisionId: 'markdown-1' }, status: 'RUNNING', attempts: 1, maxAttempts: 3,
  runAt: new Date(), lockedAt: new Date(), lockedBy: 'worker', lastError: null, dedupeKey: 'retrieve-key',
  ownerId: 'owner-1', aiRunId: 'run-1', step: 'RETRIEVING_REFERENCES', inputVersion: 5, inputHash, priority: 10,
  leaseExpiresAt: new Date(), heartbeatAt: new Date(), timeoutMs: 45_000, cancelledAt: null,
})

describe('pipeline real das etapas retrieval/materialize', () => {
  /**
   * Protege: retrieval usa Markdown aprovado exato e enfileira materializacao pelo hash do snapshot.
   * Detecta: busca rodando sobre transcricao/revisao nova ou job sem identidade.
   * Impacto: referencias sustentam conteudo rejeitado e resultado stale chega ao preview.
   */
  it('persiste REFERENCE_ONLY e encadeia LLM2', async () => {
    const fake = fakeRepository()
    const provider = { retrieve: vi.fn().mockResolvedValue({ references: [{
      id: 'project-1', type: 'PROJECT', version: '1', topicId: 'topic-1', title: 'Projeto', excerpt: 'Projeto', match: 'EXACT', score: 250, reason: 'exact:title',
    }] }) }

    const result = await processRetrievalJob(fake.repository, retrievalJob(fake.markdown.contentHash), provider)

    expect(result.kind).toBe('applied')
    expect(provider.retrieve).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-1', topics: [{ id: 'topic-1', text: '## Tarefa\nCriar prototipo.' }] }))
    expect(fake.retrievals[0]).toMatchObject({ aiRunId: 'run-1', markdownRevisionId: 'markdown-1', queryVersion: 'retrieval-v1' })
    expect(fake.run).toMatchObject({ status: 'MATERIALIZING', version: 6 })
    expect(fake.jobs[0]).toMatchObject({ type: 'ai.materialize', inputVersion: 6, inputHash: fake.retrievals[0].contentHash })
  })

  /**
   * Protege: LLM2 recebe somente Markdown aprovado + REFERENCE_ONLY e persiste proposta validada.
   * Detecta: raw output invalido ativado ou transcricao reintroduzida.
   * Impacto: segunda aprovacao revisa plano fora do contrato.
   */
  it('materializa, audita tentativa tecnica e aguarda aprovacao 2', async () => {
    const fake = fakeRepository()
    const retrievalProvider = { retrieve: vi.fn().mockResolvedValue({ references: [{
      id: 'project-1', type: 'PROJECT', version: '1', topicId: 'topic-1', title: 'Projeto', excerpt: 'Projeto', match: 'EXACT', score: 250, reason: 'exact:title',
    }] }) }
    await processRetrievalJob(fake.repository, retrievalJob(fake.markdown.contentHash), retrievalProvider)
    const snapshot = fake.retrievals[0]
    const materializeJob: any = {
      ...retrievalJob(snapshot.contentHash), id: 'job-materialize', type: 'ai.materialize',
      payload: { retrievalSnapshotId: snapshot.id }, step: 'MATERIALIZING', inputVersion: 6, inputHash: snapshot.contentHash,
    }
    const proposal = {
      schemaVersion: 1, summary: 'Criar tarefa', items: [{
        id: 'task-1', topicIds: ['topic-1'], operation: 'CREATE', entity: 'TASK', dependsOn: [],
        data: { project: { existingId: 'project-1' }, title: 'Criar prototipo' },
        evidence: [{ topicId: 'topic-1', quote: 'Criar prototipo' }], confidence: { type: 95, project: 90 }, duplicateCandidates: [],
      }], unresolved: [],
    }
    const provider = { generate: vi.fn().mockResolvedValue({
      rawOutput: JSON.stringify(proposal), provider: 'deepseek', model: 'deepseek-chat', inputTokens: 100, outputTokens: 40, latencyMs: 50,
    }) }

    const result = await processMaterializationJob(fake.repository, materializeJob, provider, {
      now: '2026-07-31T12:00:00-03:00', timezone: 'America/Sao_Paulo', promptVersion: 'materializer-v1',
    })

    expect(result.kind).toBe('applied')
    expect(fake.run).toMatchObject({ status: 'AWAITING_ENTITY_APPROVAL', version: 7, activeProposalRevisionId: expect.any(String) })
    expect(fake.proposals[0]).toMatchObject({ source: 'AI', validatedPlan: proposal, promptVersion: 'materializer-v1' })
    expect(fake.items).toHaveLength(1)
    expect(fake.attempts[0]).toMatchObject({ technicalResult: 'SUCCESS', inputHash: snapshot.contentHash, inputTokens: 100, outputTokens: 40 })
    expect(JSON.stringify(fake.attempts[0])).not.toContain('Criar prototipo')
    const prompt = JSON.parse(provider.generate.mock.calls[0]![0].user)
    expect(prompt.topics).toEqual([{ id: 'topic-1', title: 'Tarefa', text: '## Tarefa\nCriar prototipo.' }])
  })

  /**
   * Protege: retry mantém número de tentativa único por run e etapa.
   * Detecta: job novo reiniciando em 1 e colidindo com AiCallAttempt já persistida.
   * Impacto: retry falha antes de salvar proposta, mesmo quando IA respondeu corretamente.
   */
  it('numera tentativa de materialização depois das já auditadas no mesmo run', async () => {
    const fake = fakeRepository()
    const retrievalProvider = { retrieve: vi.fn().mockResolvedValue({ references: [{
      id: 'project-1', type: 'PROJECT', version: '1', topicId: 'topic-1', title: 'Projeto', excerpt: 'Projeto', match: 'EXACT', score: 250, reason: 'exact:title',
    }] }) }
    await processRetrievalJob(fake.repository, retrievalJob(fake.markdown.contentHash), retrievalProvider)
    const snapshot = fake.retrievals[0]
    fake.attempts.push({ aiRunId: 'run-1', step: 'MATERIALIZING', attempt: 5 })
    const job: any = {
      ...retrievalJob(snapshot.contentHash), id: 'job-materialize-retry', type: 'ai.materialize', attempts: 1,
      payload: { retrievalSnapshotId: snapshot.id }, step: 'MATERIALIZING', inputVersion: 6, inputHash: snapshot.contentHash,
    }
    const proposal = {
      schemaVersion: 1, summary: 'Criar tarefa', items: [{
        id: 'task-1', topicIds: ['topic-1'], operation: 'CREATE', entity: 'TASK', dependsOn: [],
        data: { project: { existingId: 'project-1' }, title: 'Criar prototipo' },
        evidence: [{ topicId: 'topic-1', quote: 'Criar prototipo' }], confidence: { type: 95, project: 90 }, duplicateCandidates: [],
      }], unresolved: [],
    }
    const provider = { generate: vi.fn().mockResolvedValue({
      rawOutput: JSON.stringify(proposal), provider: 'deepseek', model: 'deepseek-v4-pro', inputTokens: 100, outputTokens: 40, latencyMs: 50,
    }) }

    await processMaterializationJob(fake.repository, job, provider, {
      now: '2026-07-31T12:00:00-03:00', timezone: 'America/Sao_Paulo', promptVersion: 'materializer-v1',
    })

    expect(fake.attempts.at(-1)).toMatchObject({ step: 'MATERIALIZING', attempt: 6, technicalResult: 'SUCCESS' })
  })

  /**
   * Protege: referências recuperadas precisam caber integralmente na reserva da LLM 2.
   * Detecta: snapshot grande enviado truncado ou chamada inevitavelmente acima da janela.
   * Impacto: custo inútil, retry infinito ou vínculo decidido sobre contexto incompleto.
   */
  it('rejeita snapshot de referências acima da reserva antes do provedor', async () => {
    const fake = fakeRepository()
    const retrievalProvider = { retrieve: vi.fn().mockResolvedValue({ references: [{
      id: 'project-1', type: 'PROJECT', version: '1', topicId: 'topic-1', title: 'Projeto',
      excerpt: 'referência extensa '.repeat(100), match: 'EXACT', score: 250, reason: 'exact:title',
    }] }) }
    await processRetrievalJob(fake.repository, retrievalJob(fake.markdown.contentHash), retrievalProvider)
    const snapshot = fake.retrievals[0]
    const job: any = {
      ...retrievalJob(snapshot.contentHash), id: 'job-materialize-large', type: 'ai.materialize',
      payload: { retrievalSnapshotId: snapshot.id }, step: 'MATERIALIZING', inputVersion: 6, inputHash: snapshot.contentHash,
    }
    const provider = { generate: vi.fn() }

    await expect(processMaterializationJob(fake.repository, job, provider, {
      now: '2026-07-31T12:00:00-03:00', timezone: 'America/Sao_Paulo', promptVersion: 'materializer-v1',
      budget: {
        contextWindowTokens: 10_000, systemPromptTokens: 100, reservedOutputTokens: 1_000,
        reservedReferenceTokens: 10, safetyMarginTokens: 100,
      },
    })).rejects.toThrow('REFERENCE_BUDGET_EXCEEDED')
    expect(provider.generate).not.toHaveBeenCalled()
    expect(fake.attempts).toEqual([expect.objectContaining({
      step: 'MATERIALIZING', technicalResult: 'INPUT_TOO_LARGE', errorCode: 'REFERENCE_BUDGET_EXCEEDED',
    })])
    expect(JSON.stringify(fake.attempts)).not.toContain('referência extensa')
  })
})
