export type JobRecord = {
  id: string
  type: string
  payload: unknown
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  attempts: number
  maxAttempts: number
  runAt: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  dedupeKey: string | null
  ownerId: string | null
  aiRunId: string | null
  step: string | null
  inputVersion: number | null
  inputHash: string | null
  priority: number
  leaseExpiresAt: Date | null
  heartbeatAt: Date | null
  timeoutMs: number | null
  cancelledAt: Date | null
}

export type JobRepository = {
  job: {
    create(args: any): Promise<JobRecord>
    findFirst(args: any): Promise<JobRecord | null>
    findUnique(args: any): Promise<JobRecord | null>
    update(args: any): Promise<JobRecord>
    updateMany(args: any): Promise<{ count: number }>
  }
}

export type JobEnqueueRepository = {
  job: Pick<JobRepository['job'], 'create' | 'findUnique'>
}

const BASE_RETRY_MS = 30_000
const MAX_RETRY_MS = 60 * 60_000

export async function enqueue(
  repository: JobEnqueueRepository,
  input: {
    type: string
    payload?: unknown
    runAt?: Date
    dedupeKey?: string
    maxAttempts?: number
    ownerId?: string
    aiRunId?: string
    step?: string
    inputVersion?: number
    inputHash?: string
    priority?: number
    timeoutMs?: number
  },
): Promise<JobRecord> {
  try {
    return await repository.job.create({
      data: {
        type: input.type,
        payload: input.payload ?? {},
        runAt: input.runAt ?? new Date(),
        dedupeKey: input.dedupeKey ?? null,
        ...(input.maxAttempts ? { maxAttempts: input.maxAttempts } : {}),
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
        ...(input.aiRunId ? { aiRunId: input.aiRunId } : {}),
        ...(input.step ? { step: input.step } : {}),
        ...(input.inputVersion !== undefined ? { inputVersion: input.inputVersion } : {}),
        ...(input.inputHash ? { inputHash: input.inputHash } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
      },
    })
  } catch (error) {
    // Mesma dedupeKey significa "já enfileirado": webhooks e lembretes reenviados não duplicam trabalho.
    if (input.dedupeKey && hasPrismaCode(error, 'P2002')) {
      const existing = await repository.job.findUnique({ where: { dedupeKey: input.dedupeKey } })
      if (existing) return existing
    }
    throw error
  }
}

/**
 * Reserva o próximo job devido. A leitura não trava a linha, então o `updateMany`
 * condicionado a `status: PENDING` é o que garante um único vencedor; quem perde tenta o seguinte.
 */
export async function claimNext(
  repository: JobRepository,
  workerId: string,
  now = new Date(),
  leaseMs = 5 * 60_000,
): Promise<JobRecord | null> {
  const skip: string[] = []

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await repository.job.findFirst({
      where: {
        status: 'PENDING',
        runAt: { lte: now },
        cancelledAt: null,
        ...(skip.length ? { id: { notIn: [...skip] } } : {}),
      },
      orderBy: [{ priority: 'desc' }, { runAt: 'asc' }],
    })
    if (!candidate) return null

    const claimed = await repository.job.updateMany({
      where: { id: candidate.id, status: 'PENDING', cancelledAt: null },
      data: {
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      },
    })
    if (claimed.count === 1) {
      return {
        ...candidate,
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: workerId,
        attempts: candidate.attempts + 1,
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      }
    }
    skip.push(candidate.id)
  }

  return null
}

export function completeJob(repository: JobRepository, jobId: string) {
  return repository.job.update({
    where: { id: jobId },
    data: { status: 'DONE', lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastError: null },
  })
}

export function failJob(
  repository: JobRepository,
  job: Pick<JobRecord, 'id' | 'attempts' | 'maxAttempts'>,
  error: unknown,
  options: { retry?: boolean; now?: Date; random?: () => number } = {},
) {
  const now = options.now ?? new Date()
  const retry = options.retry !== false && job.attempts < job.maxAttempts
  const message = error instanceof Error ? error.message : String(error)

  return repository.job.update({
    where: { id: job.id },
    data: {
      status: retry ? 'PENDING' : 'FAILED',
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      lastError: message.slice(0, 1000),
      ...(retry ? { runAt: new Date(now.getTime() + backoffMs(job.attempts, options.random)) } : {}),
    },
  })
}

/** Worker derrubado no meio da execução deixa o job travado em RUNNING; isso o devolve à fila. */
export async function releaseStaleJobs(repository: JobRepository, timeoutMs: number, now = new Date()) {
  const expiredLease = await repository.job.updateMany({
    where: { status: 'RUNNING', leaseExpiresAt: { lt: now }, cancelledAt: null },
    data: { status: 'PENDING', lockedAt: null, lockedBy: null, leaseExpiresAt: null },
  })
  const legacyLock = await repository.job.updateMany({
    where: {
      status: 'RUNNING',
      leaseExpiresAt: null,
      lockedAt: { lt: new Date(now.getTime() - timeoutMs) },
      cancelledAt: null,
    },
    data: { status: 'PENDING', lockedAt: null, lockedBy: null },
  })
  return { count: expiredLease.count + legacyLock.count }
}

export function heartbeatJob(
  repository: JobRepository,
  jobId: string,
  workerId: string,
  now = new Date(),
  leaseMs = 5 * 60_000,
) {
  return repository.job.updateMany({
    where: { id: jobId, status: 'RUNNING', lockedBy: workerId, cancelledAt: null },
    data: { heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  }).then(({ count }) => count === 1)
}

export async function isJobCancelled(repository: JobRepository, jobId: string): Promise<boolean> {
  const job = await repository.job.findUnique({ where: { id: jobId } })
  return !job || job.cancelledAt !== null
}

export function backoffMs(attempts: number, random: () => number = Math.random) {
  const base = Math.min(BASE_RETRY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_MS)
  const jitter = 0.8 + Math.min(Math.max(random(), 0), 1) * 0.4
  return Math.round(base * jitter)
}

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
