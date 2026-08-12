import { describe, expect, it, vi } from 'vitest'
import { appendMarkdownRevision, createHarnessRun, getOrCreateExecution } from './persistence'
import { hashMarkdown } from './hash'

function createFakeHarnessRepository() {
  const inboxItems = [{ id: 'inbox-1', ownerId: 'owner-1' }]
  const runs: any[] = []
  const markdownRevisions: any[] = []
  const executions: any[] = []
  const jobs: any[] = []

  const repository: any = {
    inboxItem: {
      async findFirst({ where }: any) {
        return inboxItems.find((item) => item.id === where.id && item.ownerId === where.ownerId) ?? null
      },
    },
    aiRun: {
      async create({ data }: any) {
        const run = { id: `run-${runs.length + 1}`, version: 0, ...data }
        runs.push(run)
        return { ...run }
      },
      async findFirst({ where }: any) {
        return runs.find((run) => run.id === where.id && run.ownerId === where.ownerId) ?? null
      },
      async updateMany({ where, data }: any) {
        const run = runs.find((item) => item.id === where.id && item.ownerId === where.ownerId && item.version === where.version)
        if (!run) return { count: 0 }
        run.version += data.version.increment
        if (data.activeMarkdownRevisionId !== undefined) run.activeMarkdownRevisionId = data.activeMarkdownRevisionId
        if (data.activeProposalRevisionId !== undefined) run.activeProposalRevisionId = data.activeProposalRevisionId
        if (data.status !== undefined) run.status = data.status
        return { count: 1 }
      },
    },
    markdownRevision: {
      async findFirst({ where }: any) {
        return [...markdownRevisions].reverse().find((revision) => revision.aiRunId === where.aiRunId) ?? null
      },
      async create({ data }: any) {
        const revision = { id: `markdown-${markdownRevisions.length + 1}`, ...data }
        markdownRevisions.push(revision)
        return { ...revision }
      },
    },
    aiExecution: {
      async findUnique({ where }: any) {
        return executions.find((execution) => (
          execution.idempotencyKey === where.idempotencyKey
          || execution.proposalRevisionId === where.proposalRevisionId
        )) ?? null
      },
      async create({ data }: any) {
        if (executions.some((execution) => execution.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        }
        const execution = { id: `execution-${executions.length + 1}`, status: 'PENDING', ...data }
        executions.push(execution)
        return { ...execution }
      },
    },
    job: {
      async updateMany({ where, data }: any) {
        let count = 0
        for (const job of jobs) {
          if (job.aiRunId !== where.aiRunId || !where.status.in.includes(job.status) || !where.step.in.includes(job.step)) continue
          Object.assign(job, data)
          count += 1
        }
        return { count }
      },
    },
  }
  repository.$transaction = async (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, runs, markdownRevisions, executions, jobs }
}

describe('persistência versionada do harness v2', () => {
  /**
   * Protege: AiRun só nasce para inbox do mesmo proprietário.
   * Detecta: consulta por id sem ownerId antes da criação.
   * Impacto: usuário pode processar conteúdo de outra conta.
   */
  it('isola criação de run por proprietário', async () => {
    const fake = createFakeHarnessRepository()

    expect(await createHarnessRun(fake.repository, 'owner-2', 'inbox-1')).toEqual({ kind: 'not-found' })
    expect(fake.runs).toHaveLength(0)

    const result = await createHarnessRun(fake.repository, 'owner-1', 'inbox-1')
    expect(result).toMatchObject({ kind: 'created', run: { ownerId: 'owner-1', inboxItemId: 'inbox-1', status: 'RECEIVED', version: 0 } })
  })

  /**
   * Protege: revisão aprovada nunca é sobrescrita; edição cria versão nova.
   * Detecta: update em conteúdo antigo ou reutilização do mesmo número de versão.
   * Impacto: aprovação deixa de apontar para conteúdo reproduzível.
   */
  it('acrescenta revisões imutáveis e encadeadas', async () => {
    const fake = createFakeHarnessRepository()
    const created = await createHarnessRun(fake.repository, 'owner-1', 'inbox-1')
    if (created.kind !== 'created') throw new Error('fixture inválida')

    const first = await appendMarkdownRevision(fake.repository, 'owner-1', created.run.id, {
      expectedVersion: 0,
      source: 'AI',
      content: '# Original',
      tokenCount: 2,
    })
    const second = await appendMarkdownRevision(fake.repository, 'owner-1', created.run.id, {
      expectedVersion: 1,
      source: 'USER',
      content: '# Editado',
      tokenCount: 2,
    })

    expect(first).toMatchObject({ kind: 'created', revision: { version: 1, parentRevisionId: null, content: '# Original' } })
    if (first.kind !== 'created') throw new Error('primeira revisão não criada')
    expect(second).toMatchObject({ kind: 'created', revision: { version: 2, parentRevisionId: first.revision.id, content: '# Editado' } })
    expect(fake.markdownRevisions[0]).toMatchObject({ content: '# Original', contentHash: hashMarkdown('# Original') })
  })

  /**
   * Protege: expectedVersion participa da escrita otimista.
   * Detecta: duas edições concorrentes aceitas sobre mesma versão.
   * Impacto: correção mais nova é perdida silenciosamente.
   */
  it('rejeita versão obsoleta sem criar revisão', async () => {
    const fake = createFakeHarnessRepository()
    const created = await createHarnessRun(fake.repository, 'owner-1', 'inbox-1')
    if (created.kind !== 'created') throw new Error('fixture inválida')
    fake.runs[0].version = 3

    const result = await appendMarkdownRevision(fake.repository, 'owner-1', created.run.id, {
      expectedVersion: 2,
      source: 'USER',
      content: '# Obsoleto',
      tokenCount: 2,
    })

    expect(result).toEqual({ kind: 'stale-version' })
    expect(fake.markdownRevisions).toHaveLength(0)
  })

  /**
   * Protege: editar o Markdown depois da aprovação invalida apenas derivados e volta à aprovação 1.
   * Detecta: materialização antiga continuando ativa ou proposta velha permanecendo executável.
   * Impacto: texto removido pelo usuário pode reaparecer como entidade real.
   */
  it('cancela jobs derivados e invalida proposta ao editar Markdown aprovado', async () => {
    const fake = createFakeHarnessRepository()
    const created = await createHarnessRun(fake.repository, 'owner-1', 'inbox-1')
    if (created.kind !== 'created') throw new Error('fixture inválida')
    Object.assign(fake.runs[0], {
      status: 'AWAITING_ENTITY_APPROVAL', version: 4,
      activeMarkdownRevisionId: 'markdown-approved', activeProposalRevisionId: 'proposal-old',
    })
    fake.markdownRevisions.push({
      id: 'markdown-approved', aiRunId: created.run.id, version: 1, content: '# Antigo',
      contentHash: hashMarkdown('# Antigo'), topics: [],
    })
    fake.jobs.push({ id: 'job-old', aiRunId: created.run.id, status: 'PENDING', step: 'MATERIALIZING', cancelledAt: null })

    const result = await appendMarkdownRevision(fake.repository, 'owner-1', created.run.id, {
      expectedVersion: 4,
      source: 'USER',
      content: '# Corrigido',
      tokenCount: 2,
    })

    expect(result.kind).toBe('created')
    expect(fake.runs[0]).toMatchObject({ status: 'AWAITING_MARKDOWN_APPROVAL', activeProposalRevisionId: null })
    expect(fake.jobs[0].cancelledAt).toBeInstanceOf(Date)
  })

  /**
   * Protege: mesma proposta possui uma execução identificável.
   * Detecta: clique repetido criando segunda linha de execução.
   * Impacto: entidades podem ser duplicadas.
   */
  it('devolve execução existente para mesma chave idempotente', async () => {
    const fake = createFakeHarnessRepository()

    const first = await getOrCreateExecution(fake.repository, 'run-1', 'proposal-1')
    const second = await getOrCreateExecution(fake.repository, 'run-1', 'proposal-1')

    expect(second.id).toBe(first.id)
    expect(fake.executions).toHaveLength(1)
    expect(first.idempotencyKey).toBe('execute:proposal-1')
  })

  it('recupera execução concorrente quando unique constraint vence a corrida', async () => {
    const fake = createFakeHarnessRepository()
    const originalFind = fake.repository.aiExecution.findUnique
    fake.repository.aiExecution.findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockImplementation(originalFind)
    fake.executions.push({ id: 'execution-winner', aiRunId: 'run-1', proposalRevisionId: 'proposal-1', idempotencyKey: 'execute:proposal-1' })

    const result = await getOrCreateExecution(fake.repository, 'run-1', 'proposal-1')

    expect(result.id).toBe('execution-winner')
    expect(fake.executions).toHaveLength(1)
  })
})
