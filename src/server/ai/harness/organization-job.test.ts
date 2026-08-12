import { describe, expect, it, vi } from 'vitest'
import type { JobRecord } from '../../jobs/queue'
import { sha256 } from './hash'
import { processHarnessOrganization } from './organization-job'

const transcript = { id: 'transcript-1', aiRunId: 'run-1', version: 1, text: 'Decisao integral.', contentHash: sha256('Decisao integral.') }

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-organize-1', type: 'ai.organize', payload: { transcriptRevisionId: transcript.id },
    status: 'RUNNING', attempts: 1, maxAttempts: 3, runAt: new Date(), lockedAt: new Date(), lockedBy: 'worker-1',
    lastError: null, dedupeKey: 'organize-1', ownerId: 'owner-1', aiRunId: 'run-1', step: 'ORGANIZING',
    inputVersion: 1, inputHash: transcript.contentHash, priority: 10, leaseExpiresAt: new Date(), heartbeatAt: new Date(),
    timeoutMs: 60_000, cancelledAt: null, ...overrides,
  }
}

function fakeRepository(runOverrides: Record<string, unknown> = {}) {
  const run: any = { id: 'run-1', ownerId: 'owner-1', status: 'TRANSCRIBED', version: 1, discardedAt: null, ...runOverrides }
  const revisions: any[] = []
  const attempts: any[] = []
  const repository: any = {
    aiRun: {
      findFirst: vi.fn().mockImplementation(async () => ({ ...run })),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        if (run.id !== where.id || run.ownerId !== where.ownerId || run.version !== where.version) return { count: 0 }
        if (typeof where.status === 'string' && run.status !== where.status) return { count: 0 }
        if (data.version?.increment) run.version += data.version.increment
        Object.assign(run, Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'version')))
        return { count: 1 }
      }),
    },
    transcriptRevision: { findFirst: vi.fn().mockResolvedValue(transcript) },
    markdownRevision: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => {
        revisions.push(data)
        return data
      }),
    },
    aiCallAttempt: { create: vi.fn(async ({ data }) => { attempts.push(data); return data }) },
  }
  repository.$transaction = (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, run, revisions, attempts }
}

const context = () => ({
  signal: new AbortController().signal,
  heartbeat: vi.fn().mockResolvedValue(true),
  isCancelled: vi.fn().mockResolvedValue(false),
})

const limits = {
  contextWindowTokens: 8_000,
  systemPromptTokens: 100,
  reservedOutputTokens: 500,
  reservedReferenceTokens: 0,
  safetyMarginTokens: 100,
  maxMarkdownCharacters: 10_000,
  countTokens: (content: string) => content.length,
}

describe('job ai.organize', () => {
  /**
   * Protege: LLM 1 recebe somente transcricao/data/fuso/versao e grava revisao AI.
   * Detecta: projetos, notas ou contexto de negocio voltando ao prompt organizador.
   * Impacto: conteudo externo contamina primeira aprovacao do usuario.
   */
  it('organiza snapshot exato e aguarda aprovacao do Markdown', async () => {
    const fake = fakeRepository()
    const provider = { organize: vi.fn().mockResolvedValue({ markdown: '# Organizado\n\nDecisao integral.', topics: [{ id: 'topic-1' }] }) }

    const result = await processHarnessOrganization({
      repository: fake.repository,
      provider,
      limits,
      promptVersion: 'organizer-v1',
      timezone: 'America/Sao_Paulo',
      now: () => new Date('2026-07-31T15:00:00.000Z'),
      providerName: 'lossless',
      model: 'lossless',
    }, job(), context())

    expect(result).toMatchObject({ kind: 'organized', revision: { source: 'AI', content: '# Organizado\n\nDecisao integral.' } })
    expect(provider.organize).toHaveBeenCalledWith({
      transcript: 'Decisao integral.', currentDate: '2026-07-31', timezone: 'America/Sao_Paulo', promptVersion: 'organizer-v1',
    }, expect.any(AbortSignal))
    expect(Object.keys(provider.organize.mock.calls[0]![0])).toEqual(['transcript', 'currentDate', 'timezone', 'promptVersion'])
    expect(fake.run).toMatchObject({ status: 'AWAITING_MARKDOWN_APPROVAL', version: 2 })
    expect(fake.revisions).toHaveLength(1)
    expect(fake.revisions[0].topics).toEqual([
      expect.objectContaining({ title: 'Organizado', order: 0, id: expect.any(String) }),
    ])
    expect(fake.attempts).toEqual([expect.objectContaining({
      step: 'ORGANIZING', provider: 'lossless', model: 'lossless', technicalResult: 'SUCCESS',
      inputHash: transcript.contentHash,
    })])
    expect(JSON.stringify(fake.attempts)).not.toContain('Decisao integral')
  })

  /**
   * H05 protege: versao obsoleta nao chama LLM 1.
   * Detecta: job antigo consumindo provedor e tentando gravar sobre run novo.
   * Impacto: custo duplicado e revisao nova pode ser perdida.
   */
  it('rejeita job obsoleto antes do provedor', async () => {
    const fake = fakeRepository({ status: 'AWAITING_MARKDOWN_APPROVAL', version: 2 })
    const provider = { organize: vi.fn() }

    const result = await processHarnessOrganization({
      repository: fake.repository, provider, limits, promptVersion: 'organizer-v1', timezone: 'America/Sao_Paulo',
      providerName: 'lossless', model: 'lossless',
    }, job(), context())

    expect(result).toEqual({ kind: 'stale' })
    expect(provider.organize).not.toHaveBeenCalled()
  })

  /**
   * H12 protege: falha final retryable mantem mesma versao para retry exato.
   * Detecta: marcar FAILED incrementando versao e invalidando snapshot clonado.
   * Impacto: botao retry sempre termina como stale.
   */
  it('falha retryable preserva versao do snapshot', async () => {
    const fake = fakeRepository()
    const provider = { organize: vi.fn().mockRejectedValue(new Error('503')) }

    await expect(processHarnessOrganization({
      repository: fake.repository, provider, limits, promptVersion: 'organizer-v1', timezone: 'America/Sao_Paulo',
      providerName: 'deepseek', model: 'deepseek-chat',
    }, job({ attempts: 3, maxAttempts: 3 }), context())).rejects.toThrow('503')

    expect(fake.run).toMatchObject({ status: 'FAILED', version: 1, failedStep: 'ORGANIZING', retryable: true })
    expect(fake.attempts).toEqual([expect.objectContaining({
      step: 'ORGANIZING', technicalResult: 'ERROR', errorCode: 'ERROR', inputHash: transcript.contentHash,
    })])
    expect(JSON.stringify(fake.attempts)).not.toContain('503')
  })
})
