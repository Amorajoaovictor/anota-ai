import { enqueue, type JobRecord } from '../../jobs/queue'
import type { StorageDriver } from '../../storage'

type RunStatus =
  | 'RECEIVED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'ORGANIZING'
  | 'AWAITING_MARKDOWN_APPROVAL'
  | 'RETRIEVING_REFERENCES'
  | 'MATERIALIZING'
  | 'AWAITING_ENTITY_APPROVAL'
  | 'EXECUTING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DISCARDED'

type HarnessJobIdentity = Pick<
  JobRecord,
  'id' | 'ownerId' | 'aiRunId' | 'step' | 'inputVersion' | 'inputHash' | 'cancelledAt'
>

type CommitRepository = {
  aiRun: { updateMany(args: any): Promise<{ count: number }> }
  $transaction<T>(callback: (transaction: CommitRepository) => Promise<T>): Promise<T>
}

export type CommitHarnessJobResultOptions<T> = {
  expectedStatus: RunStatus
  nextStatus: RunStatus
  runData?: Record<string, unknown>
  write(transaction: CommitRepository): Promise<T>
}

/**
 * Faz claim otimista da versao antes da escrita derivada. A transacao garante
 * rollback do incremento caso persistir o artefato falhe.
 */
export function commitHarnessJobResult<T>(
  repository: CommitRepository,
  job: HarnessJobIdentity,
  options: CommitHarnessJobResultOptions<T>,
): Promise<{ kind: 'applied'; value: T; version: number } | { kind: 'stale' }> {
  return repository.$transaction(async (transaction) => {
    if (
      !job.aiRunId
      || !job.ownerId
      || job.inputVersion === null
      || !job.inputHash
      || job.cancelledAt
    ) return { kind: 'stale' }

    const claimed = await transaction.aiRun.updateMany({
      where: {
        id: job.aiRunId,
        ownerId: job.ownerId,
        version: job.inputVersion,
        status: options.expectedStatus,
        discardedAt: null,
      },
      data: {
        version: { increment: 1 },
        status: options.nextStatus,
        failedStep: null,
        errorCode: null,
        retryable: false,
        ...options.runData,
      },
    })
    if (claimed.count !== 1) return { kind: 'stale' }

    const value = await options.write(transaction)
    return { kind: 'applied', value, version: job.inputVersion + 1 }
  })
}

type HarnessRunRecord = {
  id: string
  ownerId: string
  inboxItemId: string
  status: RunStatus
  version: number
  failedStep: string | null
  retryable: boolean
}

type RetryRepository = {
  aiRun: {
    findFirst(args: any): Promise<HarnessRunRecord | null>
    updateMany(args: any): Promise<{ count: number }>
  }
  job: {
    findFirst(args: any): Promise<JobRecord | null>
    findUnique(args: any): Promise<JobRecord | null>
    create(args: any): Promise<JobRecord>
  }
  $transaction<T>(callback: (transaction: RetryRepository) => Promise<T>): Promise<T>
}

export type RetryHarnessRunResult =
  | { kind: 'retried'; run: HarnessRunRecord; job: JobRecord }
  | { kind: 'not-found' }
  | { kind: 'not-retryable' }
  | { kind: 'stale' }

export function retryHarnessRun(
  repository: RetryRepository,
  ownerId: string,
  inboxItemId: string,
): Promise<RetryHarnessRunResult> {
  return repository.$transaction(async (transaction) => {
    const run = await transaction.aiRun.findFirst({
      where: { inboxItemId, ownerId },
      orderBy: { createdAt: 'desc' },
    })
    if (!run) return { kind: 'not-found' }
    if (run.status !== 'FAILED' || !run.retryable || !run.failedStep) return { kind: 'not-retryable' }

    const failedJob = await transaction.job.findFirst({
      where: { aiRunId: run.id, ownerId, step: run.failedStep, status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
    })
    if (!failedJob || failedJob.inputVersion === null || !failedJob.inputHash) return { kind: 'not-retryable' }

    const workingStatus = statusForStep(failedJob.step)
    if (!workingStatus) return { kind: 'not-retryable' }
    const updated = await transaction.aiRun.updateMany({
      where: { id: run.id, ownerId, status: 'FAILED', version: run.version, retryable: true },
      data: { status: workingStatus, failedStep: null, errorCode: null, retryable: false },
    })
    if (updated.count !== 1) return { kind: 'stale' }

    const retryJob = await enqueue(transaction, {
      type: failedJob.type,
      payload: failedJob.payload,
      dedupeKey: `retry:${failedJob.id}:${failedJob.attempts}`,
      maxAttempts: failedJob.maxAttempts,
      ownerId: failedJob.ownerId ?? undefined,
      aiRunId: failedJob.aiRunId ?? undefined,
      step: failedJob.step ?? undefined,
      inputVersion: failedJob.inputVersion,
      inputHash: failedJob.inputHash,
      priority: failedJob.priority,
      timeoutMs: failedJob.timeoutMs ?? undefined,
    })
    return {
      kind: 'retried',
      run: { ...run, status: workingStatus, failedStep: null, retryable: false },
      job: retryJob,
    }
  })
}

type DiscardRepository = {
  aiRun: {
    findFirst(args: any): Promise<HarnessRunRecord | null>
    updateMany(args: any): Promise<{ count: number }>
  }
  job: {
    findMany(args: any): Promise<Array<Pick<JobRecord, 'payload'>>>
    updateMany(args: any): Promise<{ count: number }>
  }
  $transaction<T>(callback: (transaction: DiscardRepository) => Promise<T>): Promise<T>
}

export type DiscardHarnessRunResult =
  | { kind: 'discarded'; run: HarnessRunRecord; audioCleanupFailures: number }
  | { kind: 'already-discarded'; run: HarnessRunRecord }
  | { kind: 'not-found' }
  | { kind: 'not-allowed' }
  | { kind: 'stale' }

export async function discardHarnessRun(
  repository: DiscardRepository,
  storage: Pick<StorageDriver, 'delete'>,
  ownerId: string,
  inboxItemId: string,
  now = new Date(),
): Promise<DiscardHarnessRunResult> {
  const result = await repository.$transaction(async (transaction) => {
    const run = await transaction.aiRun.findFirst({
      where: { inboxItemId, ownerId },
      orderBy: { createdAt: 'desc' },
    })
    if (!run) return { kind: 'not-found' } as const
    if (run.status === 'DISCARDED') return { kind: 'already-discarded', run } as const
    if (run.status === 'PROCESSED') return { kind: 'not-allowed' } as const

    const audioJobs = await transaction.job.findMany({
      where: { aiRunId: run.id, type: 'audio.transcribe' },
      select: { payload: true },
    })
    const updated = await transaction.aiRun.updateMany({
      where: { id: run.id, ownerId, version: run.version, status: { notIn: ['PROCESSED', 'DISCARDED'] } },
      data: {
        status: 'DISCARDED',
        version: { increment: 1 },
        retryable: false,
        errorCode: null,
        failedStep: null,
        discardedAt: now,
      },
    })
    if (updated.count !== 1) return { kind: 'stale' } as const

    await transaction.job.updateMany({
      where: { aiRunId: run.id, status: { in: ['PENDING', 'RUNNING'] }, cancelledAt: null },
      data: {
        status: 'FAILED',
        cancelledAt: now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        lastError: 'Job cancelado pelo descarte do run.',
      },
    })
    return {
      kind: 'discarded',
      run: { ...run, status: 'DISCARDED' as const, version: run.version + 1, retryable: false, failedStep: null },
      storageKeys: uniqueAudioKeys(audioJobs),
    } as const
  })

  if (result.kind !== 'discarded') return result
  const deleted = await Promise.allSettled(result.storageKeys.map((key) => storage.delete(key)))
  return {
    kind: 'discarded',
    run: result.run,
    audioCleanupFailures: deleted.filter((entry) => entry.status === 'rejected').length,
  }
}

function statusForStep(step: string | null): RunStatus | null {
  switch (step) {
    case 'TRANSCRIBING': return 'TRANSCRIBING'
    case 'ORGANIZING': return 'ORGANIZING'
    case 'RETRIEVING_REFERENCES': return 'RETRIEVING_REFERENCES'
    case 'MATERIALIZING': return 'MATERIALIZING'
    case 'EXECUTING': return 'EXECUTING'
    default: return null
  }
}

function uniqueAudioKeys(jobs: Array<Pick<JobRecord, 'payload'>>): string[] {
  return [...new Set(jobs.flatMap((job) => {
    if (!job.payload || typeof job.payload !== 'object' || !('storageKey' in job.payload)) return []
    const storageKey = job.payload.storageKey
    return typeof storageKey === 'string' && storageKey.startsWith('inbox-audio/') ? [storageKey] : []
  }))]
}
