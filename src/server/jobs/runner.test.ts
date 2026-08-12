import { describe, expect, it, vi } from 'vitest'
import { UnknownJobTypeError, isJobType, resolveHandler } from './handlers'
import { DEFAULT_JOB_TIMEOUT_MS, drainJobs } from './runner'
import { createFakeJobStore } from '../../test/fake-prisma'

const fixedNow = new Date('2026-07-27T12:00:00.000Z')
const now = () => fixedNow
const due = new Date('2026-07-27T11:30:00.000Z')

describe('runner da fila', () => {
  it('limita cada job a cinco minutos por padrão', () => {
    expect(DEFAULT_JOB_TIMEOUT_MS).toBe(5 * 60_000)
  })

  it('executa os jobs devidos até o tamanho do lote', async () => {
    const store = createFakeJobStore([
      { id: 'job-1', runAt: due },
      { id: 'job-2', runAt: due },
      { id: 'job-3', runAt: due },
    ])
    const handler = vi.fn().mockResolvedValue(undefined)

    const result = await drainJobs(store, { batchSize: 2, resolve: () => handler, now })

    expect(result).toMatchObject({ claimed: 2, completed: 2, failed: 0 })
    expect(handler).toHaveBeenCalledTimes(2)
    expect(store.jobs.filter((job) => job.status === 'DONE')).toHaveLength(2)
    expect(store.jobs.find((job) => job.id === 'job-3')?.status).toBe('PENDING')
  })

  it('reagenda o job quando o handler falha', async () => {
    const store = createFakeJobStore([{ id: 'job-1', runAt: due }])

    const result = await drainJobs(store, {
      resolve: () => async () => { throw new Error('provedor fora do ar') },
      now,
    })

    expect(result).toMatchObject({ claimed: 1, completed: 0, failed: 1 })
    expect(store.jobs[0]).toMatchObject({ status: 'PENDING', lastError: 'provedor fora do ar' })
    expect(store.jobs[0]!.runAt.getTime()).toBeGreaterThan(now().getTime())
  })

  it('interrompe a espera pelo handler no timeout e continua o lote', async () => {
    const store = createFakeJobStore([
      { id: 'job-lento', runAt: due },
      { id: 'job-seguinte', runAt: due },
    ])
    const handler = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)))
      .mockResolvedValueOnce(undefined)

    const result = await drainJobs(store, { batchSize: 2, jobTimeoutMs: 10, resolve: () => handler, now })

    expect(result).toMatchObject({ claimed: 2, completed: 1, failed: 1 })
    expect(store.jobs.find((job) => job.id === 'job-lento')).toMatchObject({
      status: 'PENDING',
      lastError: 'Job excedeu timeout de 10 ms.',
    })
    expect(store.jobs.find((job) => job.id === 'job-seguinte')?.status).toBe('DONE')
  })

  /**
   * H14 protege: timeout aborta chamada externa, nao apenas abandona Promise.
   * Detecta: Promise.race rejeitando enquanto fetch/STT continua consumindo recurso.
   * Impacto: cobranca indevida e resultado tardio pode duplicar trabalho.
   */
  it('aborta o signal entregue ao handler quando timeout vence', async () => {
    const store = createFakeJobStore([{ id: 'job-lento', runAt: due, timeoutMs: 10 }])
    let receivedSignal: AbortSignal | undefined
    const handler = vi.fn().mockImplementation((_job, context) => {
      receivedSignal = context.signal
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true })
      })
    })

    const result = await drainJobs(store, { resolve: () => handler, now, heartbeatIntervalMs: 1_000 })

    expect(result).toMatchObject({ claimed: 1, completed: 0, failed: 1 })
    expect(receivedSignal?.aborted).toBe(true)
    expect(store.jobs[0]?.lastError).toBe('Job excedeu timeout de 10 ms.')
  })

  it('não tenta de novo job de tipo desconhecido', async () => {
    const store = createFakeJobStore([{ id: 'job-1', type: 'trello.sync', runAt: due }])

    const result = await drainJobs(store, { now })

    expect(result).toMatchObject({ failed: 1 })
    expect(store.jobs[0]?.status).toBe('FAILED')
  })

  it('libera locks órfãos antes de reservar', async () => {
    const store = createFakeJobStore([
      { id: 'travado', status: 'RUNNING', runAt: due, lockedAt: new Date('2026-07-27T11:00:00.000Z') },
    ])
    const handler = vi.fn().mockResolvedValue(undefined)

    const result = await drainJobs(store, { resolve: () => handler, now })

    expect(result).toMatchObject({ released: 1, claimed: 1, completed: 1 })
  })

  it('reconhece só os tipos previstos para as próximas fases', () => {
    expect(isJobType('ai.classify')).toBe(true)
    expect(isJobType('audio.transcribe')).toBe(true)
    expect(isJobType('ai.organize')).toBe(true)
    expect(isJobType('ai.retrieve')).toBe(true)
    expect(isJobType('ai.materialize')).toBe(true)
    expect(isJobType('ai.execute')).toBe(true)
    expect(isJobType('ai.cleanup-audio')).toBe(true)
    expect(isJobType('ai.sweep-audio')).toBe(true)
    expect(isJobType('reminder.dispatch')).toBe(true)
    expect(isJobType('mcp.write')).toBe(false)
    expect(() => resolveHandler('mcp.write')).toThrow(UnknownJobTypeError)
  })
})
