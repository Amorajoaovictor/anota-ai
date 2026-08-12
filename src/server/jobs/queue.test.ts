import { describe, expect, it } from 'vitest'
import { backoffMs, claimNext, completeJob, enqueue, failJob, heartbeatJob, releaseStaleJobs } from './queue'
import { createFakeJobStore } from '../../test/fake-prisma'

const now = new Date('2026-07-27T12:00:00.000Z')

describe('fila de jobs', () => {
  it('enfileira com payload e data de execução', async () => {
    const store = createFakeJobStore()

    const job = await enqueue(store, { type: 'ai.classify', payload: { inboxId: 'inbox-1' }, runAt: now })

    expect(job).toMatchObject({ type: 'ai.classify', status: 'PENDING', attempts: 0, runAt: now })
  })

  it('devolve o job existente quando a dedupeKey se repete', async () => {
    const store = createFakeJobStore()

    const first = await enqueue(store, { type: 'reminder.dispatch', dedupeKey: 'task-1:7d' })
    const second = await enqueue(store, { type: 'reminder.dispatch', dedupeKey: 'task-1:7d' })

    expect(second.id).toBe(first.id)
    expect(store.jobs).toHaveLength(1)
  })

  it('reserva apenas jobs devidos, do mais antigo para o mais novo', async () => {
    const store = createFakeJobStore([
      { id: 'futuro', runAt: new Date('2026-07-27T13:00:00.000Z') },
      { id: 'antigo', runAt: new Date('2026-07-27T10:00:00.000Z') },
      { id: 'recente', runAt: new Date('2026-07-27T11:00:00.000Z') },
    ])

    const first = await claimNext(store, 'worker-1', now)
    const second = await claimNext(store, 'worker-1', now)
    const third = await claimNext(store, 'worker-1', now)

    expect([first?.id, second?.id]).toEqual(['antigo', 'recente'])
    expect(first).toMatchObject({ status: 'RUNNING', lockedBy: 'worker-1', attempts: 1 })
    expect(third).toBeNull()
  })

  it('não entrega o mesmo job a dois workers', async () => {
    const store = createFakeJobStore([{ id: 'job-1', runAt: now }])

    const [first, second] = await Promise.all([
      claimNext(store, 'worker-1', now),
      claimNext(store, 'worker-2', now),
    ])

    expect([first, second].filter(Boolean)).toHaveLength(1)
  })

  it('reagenda com backoff crescente enquanto houver tentativa', async () => {
    const store = createFakeJobStore([{ id: 'job-1', attempts: 2, maxAttempts: 5 }])

    const job = await failJob(store, { id: 'job-1', attempts: 2, maxAttempts: 5 }, new Error('timeout'), { now, random: () => 0.5 })

    expect(job.status).toBe('PENDING')
    expect(job.lastError).toBe('timeout')
    expect(job.runAt.getTime()).toBe(now.getTime() + backoffMs(2, () => 0.5))
    expect(backoffMs(3)).toBeGreaterThan(backoffMs(2))
  })

  it('marca como FAILED ao esgotar as tentativas', async () => {
    const store = createFakeJobStore([{ id: 'job-1', attempts: 5, maxAttempts: 5 }])

    const job = await failJob(store, { id: 'job-1', attempts: 5, maxAttempts: 5 }, new Error('falhou'), { now })

    expect(job.status).toBe('FAILED')
  })

  it('permite marcar falha definitiva antes do limite', async () => {
    const store = createFakeJobStore([{ id: 'job-1', attempts: 1, maxAttempts: 5 }])

    const job = await failJob(store, { id: 'job-1', attempts: 1, maxAttempts: 5 }, new Error('x'), { retry: false, now })

    expect(job.status).toBe('FAILED')
  })

  it('devolve à fila jobs travados por worker derrubado', async () => {
    const store = createFakeJobStore([
      { id: 'travado', status: 'RUNNING', lockedAt: new Date('2026-07-27T11:00:00.000Z'), lockedBy: 'worker-morto' },
      { id: 'ativo', status: 'RUNNING', lockedAt: new Date('2026-07-27T11:59:00.000Z'), lockedBy: 'worker-vivo' },
    ])

    const released = await releaseStaleJobs(store, 5 * 60_000, now)

    expect(released.count).toBe(1)
    expect(store.jobs.find((job) => job.id === 'travado')).toMatchObject({ status: 'PENDING', lockedBy: null })
    expect(store.jobs.find((job) => job.id === 'ativo')?.status).toBe('RUNNING')
  })

  /**
   * H14 protege: worker ativo renova lease sem permitir que outro worker tome job.
   * Detecta: heartbeat sem filtro de worker/status ou lease que nunca e estendida.
   * Impacto: mesma chamada externa roda duas vezes, cobrando e gravando em duplicidade.
   */
  it('renova heartbeat e lease somente para worker que possui o claim', async () => {
    const store = createFakeJobStore([{
      id: 'job-1',
      status: 'RUNNING',
      lockedBy: 'worker-1',
      leaseExpiresAt: new Date('2026-07-27T12:01:00.000Z'),
    }])

    expect(await heartbeatJob(store, 'job-1', 'worker-2', now, 60_000)).toBe(false)
    expect(await heartbeatJob(store, 'job-1', 'worker-1', now, 60_000)).toBe(true)
    expect(store.jobs[0]).toMatchObject({
      heartbeatAt: now,
      leaseExpiresAt: new Date('2026-07-27T12:01:00.000Z'),
    })
  })

  /**
   * Protege: prioridade interativa vence job antigo nao urgente sem ignorar runAt.
   * Detecta: claim ordenando apenas por data depois da adicao de priority.
   * Impacto: usuario espera transcricao enquanto lembretes ocupam worker.
   */
  it('prioriza job interativo e ignora job cancelado', async () => {
    const store = createFakeJobStore([
      { id: 'lembrete', priority: 0, runAt: new Date('2026-07-27T10:00:00.000Z') },
      { id: 'interativo', priority: 10, runAt: new Date('2026-07-27T11:00:00.000Z') },
      { id: 'cancelado', priority: 100, runAt: new Date('2026-07-27T11:30:00.000Z'), cancelledAt: now },
    ])

    const claimed = await claimNext(store, 'worker-1', now)

    expect(claimed?.id).toBe('interativo')
    expect(claimed?.leaseExpiresAt).toEqual(new Date('2026-07-27T12:05:00.000Z'))
  })

  it('limpa lock e erro ao concluir', async () => {
    const store = createFakeJobStore([{ id: 'job-1', status: 'RUNNING', lockedBy: 'worker-1', lastError: 'anterior' }])

    const job = await completeJob(store, 'job-1')

    expect(job).toMatchObject({ status: 'DONE', lockedBy: null, lastError: null })
  })
})
