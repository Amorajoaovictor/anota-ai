import { describe, expect, it, vi } from 'vitest'
import type { JobRecord } from '../../jobs/queue'
import { commitHarnessJobResult, discardHarnessRun, retryHarnessRun } from './orchestration'

function harnessJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    type: 'ai.organize',
    payload: { transcriptRevisionId: 'transcript-1' },
    status: 'RUNNING',
    attempts: 1,
    maxAttempts: 5,
    runAt: new Date('2026-07-31T12:00:00.000Z'),
    lockedAt: new Date('2026-07-31T12:00:00.000Z'),
    lockedBy: 'worker-1',
    lastError: null,
    dedupeKey: 'run-1:ORGANIZING:2:hash-2',
    ownerId: 'owner-1',
    aiRunId: 'run-1',
    step: 'ORGANIZING',
    inputVersion: 2,
    inputHash: 'hash-2',
    priority: 10,
    leaseExpiresAt: new Date('2026-07-31T12:05:00.000Z'),
    heartbeatAt: new Date('2026-07-31T12:00:00.000Z'),
    timeoutMs: 60_000,
    cancelledAt: null,
    ...overrides,
  }
}

describe('orquestracao versionada do harness', () => {
  /**
   * H05 protege: resultado so entra se versao, estado e proprietario ainda forem os do claim.
   * Detecta: job antigo sobrescrevendo revisao criada enquanto provedor respondia.
   * Impacto: correcao humana some e confianca no fluxo e quebrada.
   */
  it('rejeita resultado obsoleto antes de persistir artefato', async () => {
    const write = vi.fn()
    const repository: any = {
      aiRun: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    repository.$transaction = (callback: (transaction: any) => Promise<unknown>) => callback(repository)

    const result = await commitHarnessJobResult(repository, harnessJob(), {
      expectedStatus: 'ORGANIZING',
      nextStatus: 'AWAITING_MARKDOWN_APPROVAL',
      write,
    })

    expect(result).toEqual({ kind: 'stale' })
    expect(write).not.toHaveBeenCalled()
    expect(repository.aiRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'run-1', ownerId: 'owner-1', version: 2, status: 'ORGANIZING' }),
    }))
  })

  /**
   * H12 protege: retry clona payload, versao e hash do job falho.
   * Detecta: retry relendo snapshot ativo ou montando payload com revisao diferente.
   * Impacto: mesma acao produz resultado irreproduzivel e pode ressuscitar texto removido.
   */
  it('retry usa snapshot exato do job falho', async () => {
    const previous = harnessJob({ status: 'FAILED', attempts: 5, lastError: 'timeout' })
    const create = vi.fn().mockImplementation(({ data }) => ({ id: 'job-retry', attempts: 0, status: 'PENDING', ...data }))
    const run = {
      id: 'run-1', ownerId: 'owner-1', inboxItemId: 'inbox-1', status: 'FAILED', version: 2,
      failedStep: 'ORGANIZING', retryable: true,
    }
    const repository: any = {
      aiRun: {
        findFirst: vi.fn().mockResolvedValue(run),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      job: {
        findFirst: vi.fn().mockResolvedValue(previous),
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    }
    repository.$transaction = (callback: (transaction: any) => Promise<unknown>) => callback(repository)

    const result = await retryHarnessRun(repository, 'owner-1', 'inbox-1')

    expect(result).toMatchObject({ kind: 'retried', run: { status: 'ORGANIZING', version: 2 } })
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      payload: previous.payload,
      inputVersion: previous.inputVersion,
      inputHash: previous.inputHash,
      ownerId: previous.ownerId,
      aiRunId: previous.aiRunId,
      step: previous.step,
    }) })
  })

  /**
   * H15 protege: descarte muda estado, invalida versao, cancela jobs e apaga audio temporario.
   * Detecta: worker ativo concluindo depois do descarte ou arquivo ficando retido.
   * Impacto: conteudo descartado reaparece e viola privacidade.
   */
  it('descarta run, cancela jobs e apaga audio', async () => {
    const now = new Date('2026-07-31T15:00:00.000Z')
    const run = { id: 'run-1', ownerId: 'owner-1', inboxItemId: 'inbox-1', status: 'TRANSCRIBING', version: 0 }
    const repository: any = {
      aiRun: {
        findFirst: vi.fn().mockResolvedValue(run),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      job: {
        findMany: vi.fn().mockResolvedValue([
          harnessJob({ type: 'audio.transcribe', payload: { storageKey: 'inbox-audio/owner-1/audio-1', contentType: 'audio/webm' } }),
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
    repository.$transaction = (callback: (transaction: any) => Promise<unknown>) => callback(repository)
    const storage = { delete: vi.fn().mockResolvedValue(undefined) }

    const result = await discardHarnessRun(repository, storage, 'owner-1', 'inbox-1', now)

    expect(result).toMatchObject({ kind: 'discarded', run: { status: 'DISCARDED', version: 1 } })
    expect(repository.job.updateMany).toHaveBeenCalledWith({
      where: { aiRunId: 'run-1', status: { in: ['PENDING', 'RUNNING'] }, cancelledAt: null },
      data: {
        status: 'FAILED',
        cancelledAt: now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        lastError: 'Job cancelado pelo descarte do run.',
      },
    })
    expect(storage.delete).toHaveBeenCalledWith('inbox-audio/owner-1/audio-1')
  })
})
