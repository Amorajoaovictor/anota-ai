import { toPublicHarnessConfig, type HarnessV2Config } from './config'

export type MetricTags = Record<string, string | number | boolean>

export type TechnicalMetrics = {
  increment(name: string, tags?: MetricTags): void
  observe(name: string, value: number, tags?: MetricTags): void
}

export const noopTechnicalMetrics: TechnicalMetrics = {
  increment() {},
  observe() {},
}

export type RecordedTechnicalMetric = {
  kind: 'counter' | 'observation'
  name: string
  value: number
  tags: MetricTags
}

/** Coletor pequeno para testes/adapters; nunca recebe prompt ou conteudo bruto. */
export function createInMemoryTechnicalMetrics(): TechnicalMetrics & { records: RecordedTechnicalMetric[] } {
  const records: RecordedTechnicalMetric[] = []
  return {
    records,
    increment(name, tags = {}) {
      records.push({ kind: 'counter', name, value: 1, tags })
    },
    observe(name, value, tags = {}) {
      records.push({ kind: 'observation', name, value, tags })
    },
  }
}

type QueueHealthRepository = {
  job: {
    count(args: any): Promise<number>
    findFirst(args: any): Promise<{ runAt: Date } | null>
    findMany(args: any): Promise<Array<{ lockedBy: string | null }>>
  }
}

export async function collectQueueHealth(
  repository: QueueHealthRepository,
  options: { now?: Date; activeWithinMs?: number; metrics?: TechnicalMetrics; ownerId?: string } = {},
) {
  const now = options.now ?? new Date()
  const activeWithinMs = options.activeWithinMs ?? 60_000
  const baseWhere = { status: 'PENDING', cancelledAt: null, ...(options.ownerId ? { ownerId: options.ownerId } : {}) }
  const [backlog, oldest, workers] = await Promise.all([
    repository.job.count({ where: baseWhere }),
    repository.job.findFirst({
      where: baseWhere,
      orderBy: { runAt: 'asc' },
      select: { runAt: true },
    }),
    repository.job.findMany({
      where: {
        status: 'RUNNING',
        cancelledAt: null,
        heartbeatAt: { gte: new Date(now.getTime() - activeWithinMs) },
        ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      },
      select: { lockedBy: true },
    }),
  ])
  const oldestJobAgeMs = oldest ? Math.max(0, now.getTime() - oldest.runAt.getTime()) : 0
  const activeWorkers = new Set(workers.flatMap((worker) => worker.lockedBy ? [worker.lockedBy] : [])).size
  options.metrics?.observe('harness.queue.backlog', backlog)
  options.metrics?.observe('harness.queue.oldest_job_age_ms', oldestJobAgeMs)
  options.metrics?.observe('harness.queue.active_workers', activeWorkers)
  return { backlog, oldestJobAgeMs, activeWorkers }
}

export type HarnessOperationalAlert = {
  code: 'BACKLOG_HIGH' | 'OLDEST_JOB_HIGH' | 'NO_ACTIVE_WORKER'
  severity: 'warning' | 'critical'
}

export async function buildHarnessOperationalHealth(
  repository: QueueHealthRepository,
  ownerId: string,
  config: HarnessV2Config,
  now = new Date(),
) {
  const queue = await collectQueueHealth(repository, {
    ownerId,
    now,
    activeWithinMs: config.alerts.noActiveWorkerGraceMs,
  })
  const alerts: HarnessOperationalAlert[] = []
  if (queue.backlog >= config.alerts.backlog) alerts.push({ code: 'BACKLOG_HIGH', severity: 'warning' })
  if (queue.oldestJobAgeMs >= config.alerts.oldestJobAgeMs) alerts.push({ code: 'OLDEST_JOB_HIGH', severity: 'warning' })
  if (
    queue.backlog > 0
    && queue.activeWorkers === 0
    && queue.oldestJobAgeMs >= config.alerts.noActiveWorkerGraceMs
  ) alerts.push({ code: 'NO_ACTIVE_WORKER', severity: 'critical' })

  const status = alerts.some((alert) => alert.severity === 'critical')
    ? 'critical'
    : alerts.length > 0 ? 'warning' : 'ok'
  return {
    status,
    queue,
    alerts,
    rollout: toPublicHarnessConfig(config, ownerId),
  } as const
}
