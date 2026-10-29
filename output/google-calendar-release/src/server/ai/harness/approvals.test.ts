import { describe, expect, it } from 'vitest'
import { approveMarkdownSnapshot } from './approvals'

function fakeRepository() {
  const run: any = {
    id: 'run-1', ownerId: 'owner-1', status: 'AWAITING_MARKDOWN_APPROVAL', version: 4,
    activeMarkdownRevisionId: 'markdown-2',
  }
  const revision: any = {
    id: 'markdown-2', aiRunId: 'run-1', contentHash: 'hash-approved', approvedAt: null,
  }
  const approvals: any[] = []
  const jobs: any[] = []
  const repository: any = {
    aiRun: {
      findFirst: async ({ where }: any) => run.id === where.id && run.ownerId === where.ownerId ? { ...run } : null,
      updateMany: async ({ where, data }: any) => {
        if (run.id !== where.id || run.ownerId !== where.ownerId || run.version !== where.version || run.status !== where.status) return { count: 0 }
        run.version += data.version.increment
        run.status = data.status
        return { count: 1 }
      },
    },
    markdownRevision: {
      findFirst: async ({ where }: any) => revision.id === where.id && revision.aiRunId === where.aiRunId ? { ...revision } : null,
      update: async ({ data }: any) => Object.assign(revision, data),
    },
    aiApproval: {
      findUnique: async ({ where }: any) => approvals.find((entry) => entry.type === where.type_targetId.type && entry.targetId === where.type_targetId.targetId) ?? null,
      create: async ({ data }: any) => {
        const approval = { id: `approval-${approvals.length + 1}`, ...data }
        approvals.push(approval)
        return approval
      },
    },
    job: {
      create: async ({ data }: any) => {
        const job = { id: `job-${jobs.length + 1}`, ...data }
        jobs.push(job)
        return job
      },
      findUnique: async () => null,
    },
  }
  repository.$transaction = async (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, run, revision, approvals, jobs }
}

describe('Fase 4 - aprovacao exata do Markdown', () => {
  /**
   * Protege: aprovacao aponta para revisao ativa e hash exato do mesmo dono.
   * Detecta: rota aprovando "versao atual" mutavel ou ID de outra conta.
   * Impacto: LLM 2 pode receber conteudo diferente do revisado pelo usuario.
   */
  it('aprova snapshot exato, avanca estado e enfileira retrieval versionado', async () => {
    const fake = fakeRepository()

    const result = await approveMarkdownSnapshot(fake.repository, 'owner-1', 'run-1', {
      revisionId: 'markdown-2', targetHash: 'hash-approved', expectedVersion: 4,
    })

    expect(result).toMatchObject({ kind: 'approved', approval: { targetId: 'markdown-2', targetHash: 'hash-approved' } })
    expect(fake.run).toMatchObject({ status: 'RETRIEVING_REFERENCES', version: 5 })
    expect(fake.revision.approvedAt).toBeInstanceOf(Date)
    expect(fake.jobs).toEqual([expect.objectContaining({
      type: 'ai.retrieve', ownerId: 'owner-1', aiRunId: 'run-1', step: 'RETRIEVING_REFERENCES',
      inputVersion: 5, inputHash: 'hash-approved', dedupeKey: 'retrieve:run-1:hash-approved:retrieval-v1',
    })])
  })

  /**
   * Protege: expectedVersion e hash impedem corrida ou aprovacao obsoleta.
   * Detecta: duas abas aprovando revisoes diferentes da mesma run.
   * Impacto: intencao corrigida e perdida silenciosamente.
   */
  it('rejeita versao ou hash obsoleto sem escrever', async () => {
    const stale = fakeRepository()
    expect(await approveMarkdownSnapshot(stale.repository, 'owner-1', 'run-1', {
      revisionId: 'markdown-2', targetHash: 'hash-approved', expectedVersion: 3,
    })).toEqual({ kind: 'stale-version' })
    expect(stale.approvals).toHaveLength(0)

    const wrongHash = fakeRepository()
    expect(await approveMarkdownSnapshot(wrongHash.repository, 'owner-1', 'run-1', {
      revisionId: 'markdown-2', targetHash: 'hash-old', expectedVersion: 4,
    })).toEqual({ kind: 'hash-mismatch' })
    expect(wrongHash.approvals).toHaveLength(0)
  })

  /**
   * Protege: repeticao da mesma aprovacao e idempotente.
   * Detecta: duplo clique criando dois jobs de recuperacao.
   * Impacto: custo duplicado e propostas concorrentes.
   */
  it('devolve aprovacao existente sem novo job', async () => {
    const fake = fakeRepository()
    const input = { revisionId: 'markdown-2', targetHash: 'hash-approved', expectedVersion: 4 }
    const first = await approveMarkdownSnapshot(fake.repository, 'owner-1', 'run-1', input)
    const second = await approveMarkdownSnapshot(fake.repository, 'owner-1', 'run-1', { ...input, expectedVersion: 5 })

    expect(first.kind).toBe('approved')
    expect(second.kind).toBe('already-approved')
    expect(fake.approvals).toHaveLength(1)
    expect(fake.jobs).toHaveLength(1)
  })

  it('nao revela run de outro proprietario', async () => {
    const fake = fakeRepository()
    expect(await approveMarkdownSnapshot(fake.repository, 'owner-2', 'run-1', {
      revisionId: 'markdown-2', targetHash: 'hash-approved', expectedVersion: 4,
    })).toEqual({ kind: 'not-found' })
  })
})
