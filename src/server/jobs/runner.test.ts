import { describe, expect, it, vi } from 'vitest'
import { UnknownJobTypeError, isJobType, resolveHandler } from './handlers'
import { drainJobs } from './runner'
import { createFakeJobStore } from '../../test/fake-prisma'

const fixedNow = new Date('2026-07-27T12:00:00.000Z')
const now = () => fixedNow
const due = new Date('2026-07-27T11:30:00.000Z')

describe('runner da fila', () => {
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
    expect(isJobType('reminder.dispatch')).toBe(true)
    expect(isJobType('mcp.write')).toBe(false)
    expect(() => resolveHandler('mcp.write')).toThrow(UnknownJobTypeError)
  })
})
