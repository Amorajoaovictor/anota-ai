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

const BASE_RETRY_MS = 30_000
const MAX_RETRY_MS = 60 * 60_000

export async function enqueue(
  repository: JobRepository,
  input: { type: string; payload?: unknown; runAt?: Date; dedupeKey?: string; maxAttempts?: number },
): Promise<JobRecord> {
  try {
    return await repository.job.create({
      data: {
        type: input.type,
        payload: input.payload ?? {},
        runAt: input.runAt ?? new Date(),
        dedupeKey: input.dedupeKey ?? null,
        ...(input.maxAttempts ? { maxAttempts: input.maxAttempts } : {}),
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
): Promise<JobRecord | null> {
  const skip: string[] = []

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await repository.job.findFirst({
      where: {
        status: 'PENDING',
        runAt: { lte: now },
        ...(skip.length ? { id: { notIn: [...skip] } } : {}),
      },
      orderBy: { runAt: 'asc' },
    })
    if (!candidate) return null

    const claimed = await repository.job.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: { status: 'RUNNING', lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } },
    })
    if (claimed.count === 1) {
      return { ...candidate, status: 'RUNNING', lockedAt: now, lockedBy: workerId, attempts: candidate.attempts + 1 }
    }
    skip.push(candidate.id)
  }

  return null
}

export function completeJob(repository: JobRepository, jobId: string) {
  return repository.job.update({
    where: { id: jobId },
    data: { status: 'DONE', lockedAt: null, lockedBy: null, lastError: null },
  })
}

export function failJob(
  repository: JobRepository,
  job: Pick<JobRecord, 'id' | 'attempts' | 'maxAttempts'>,
  error: unknown,
  options: { retry?: boolean; now?: Date } = {},
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
      lastError: message.slice(0, 1000),
      ...(retry ? { runAt: new Date(now.getTime() + backoffMs(job.attempts)) } : {}),
    },
  })
}

/** Worker derrubado no meio da execução deixa o job travado em RUNNING; isso o devolve à fila. */
export function releaseStaleJobs(repository: JobRepository, timeoutMs: number, now = new Date()) {
  return repository.job.updateMany({
    where: { status: 'RUNNING', lockedAt: { lt: new Date(now.getTime() - timeoutMs) } },
    data: { status: 'PENDING', lockedAt: null, lockedBy: null },
  })
}

export function backoffMs(attempts: number) {
  return Math.min(BASE_RETRY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_MS)
}

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
