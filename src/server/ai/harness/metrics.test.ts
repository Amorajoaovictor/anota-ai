import { describe, expect, it, vi } from 'vitest'
import { buildHarnessOperationalHealth, collectQueueHealth, createInMemoryTechnicalMetrics } from './metrics'
import { readHarnessV2Config } from './config'

describe('metricas tecnicas do harness', () => {
  /**
   * Protege: operacao enxerga backlog, idade do job mais antigo e workers com heartbeat recente.
   * Detecta: health check dizendo apenas processo vivo enquanto fila esta parada.
   * Impacto: transcricoes acumulam sem alerta e usuario espera indefinidamente.
   */
  it('resume saude da fila sem ler payload ou conteudo', async () => {
    const now = new Date('2026-07-31T15:00:00.000Z')
    const repository: any = {
      job: {
        count: vi.fn().mockResolvedValue(4),
        findFirst: vi.fn().mockResolvedValue({ runAt: new Date('2026-07-31T14:55:00.000Z') }),
        findMany: vi.fn().mockResolvedValue([{ lockedBy: 'worker-1' }, { lockedBy: 'worker-1' }, { lockedBy: 'worker-2' }]),
      },
    }
    const metrics = createInMemoryTechnicalMetrics()

    const health = await collectQueueHealth(repository, { now, activeWithinMs: 60_000, metrics })

    expect(health).toEqual({ backlog: 4, oldestJobAgeMs: 300_000, activeWorkers: 2 })
    expect(repository.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { lockedBy: true },
    }))
    expect(metrics.records.map((record) => record.name)).toEqual([
      'harness.queue.backlog', 'harness.queue.oldest_job_age_ms', 'harness.queue.active_workers',
    ])
  })

  /**
   * Protege: alertas derivam somente de contagens/idades owner-scoped.
   * Detecta: health incluindo payload, hash, texto ou deixando backlog sem worker como ok.
   * Impacto: vazamento de conteudo e incidente silencioso.
   */
  it('gera alertas owner-scoped sem conteudo sensivel', async () => {
    const repository: any = {
      job: {
        count: vi.fn().mockResolvedValue(12),
        findFirst: vi.fn().mockResolvedValue({ runAt: new Date('2026-07-31T14:55:00.000Z') }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    const config = readHarnessV2Config({
      AI_HARNESS_V2_ENABLED: 'true',
      AI_HARNESS_ALERT_BACKLOG: '10',
      AI_HARNESS_ALERT_OLDEST_JOB_MS: '60000',
      AI_HARNESS_ALERT_NO_WORKER_GRACE_MS: '30000',
    })

    const result = await buildHarnessOperationalHealth(repository, 'owner-1', config, new Date('2026-07-31T15:00:00.000Z'))

    expect(result.status).toBe('critical')
    expect(result.alerts.map((alert) => alert.code)).toEqual(['BACKLOG_HIGH', 'OLDEST_JOB_HIGH', 'NO_ACTIVE_WORKER'])
    expect(repository.job.count).toHaveBeenCalledWith({ where: { status: 'PENDING', cancelledAt: null, ownerId: 'owner-1' } })
    expect(JSON.stringify(result)).not.toMatch(/payload|inputHash|text|token|secret/i)
  })
})
