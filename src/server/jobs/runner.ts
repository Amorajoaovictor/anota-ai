import { resolveHandler, UnknownJobTypeError, type JobHandler } from './handlers'
import {
  claimNext,
  completeJob,
  failJob,
  heartbeatJob,
  isJobCancelled,
  releaseStaleJobs,
  type JobRecord,
  type JobRepository,
} from './queue'

export const DEFAULT_JOB_TIMEOUT_MS = 5 * 60_000

export type DrainResult = {
  claimed: number
  completed: number
  failed: number
  released: number
}

export type DrainOptions = {
  batchSize?: number
  workerId?: string
  lockTimeoutMs?: number
  jobTimeoutMs?: number
  heartbeatIntervalMs?: number
  leaseMs?: number
  resolve?: (type: string) => JobHandler
  now?: () => Date
}

export async function drainJobs(repository: JobRepository, options: DrainOptions = {}): Promise<DrainResult> {
  const batchSize = options.batchSize ?? 10
  const workerId = options.workerId ?? `worker-${process.pid}`
  const resolve = options.resolve ?? resolveHandler
  const now = options.now ?? (() => new Date())
  const jobTimeoutMs = options.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS
  const leaseMs = options.leaseMs ?? options.lockTimeoutMs ?? 5 * 60_000

  const released = await releaseStaleJobs(repository, options.lockTimeoutMs ?? 5 * 60_000, now())
  const result: DrainResult = { claimed: 0, completed: 0, failed: 0, released: released.count }

  for (let processed = 0; processed < batchSize; processed += 1) {
    const job = await claimNext(repository, workerId, now(), leaseMs)
    if (!job) break
    result.claimed += 1

    try {
      const handler = resolve(job.type)
      await runJob(repository, job, workerId, handler, {
        timeoutMs: job.timeoutMs ?? jobTimeoutMs,
        heartbeatIntervalMs: options.heartbeatIntervalMs,
        leaseMs,
        now,
      })
      await completeJob(repository, job.id)
      result.completed += 1
    } catch (error) {
      // Tipo desconhecido não melhora com nova tentativa: falha direto e fica visível para inspeção.
      await failJob(repository, job, error, {
        retry: !(error instanceof UnknownJobTypeError || error instanceof JobCancelledError),
        now: now(),
      })
      result.failed += 1
    }
  }

  return result
}

export class JobCancelledError extends Error {
  constructor() {
    super('Job cancelado.')
    this.name = 'JobCancelledError'
  }
}

async function runJob(
  repository: JobRepository,
  job: JobRecord,
  workerId: string,
  handler: JobHandler,
  options: {
    timeoutMs: number
    heartbeatIntervalMs?: number
    leaseMs: number
    now(): Date
  },
): Promise<void> {
  if (await isJobCancelled(repository, job.id)) throw new JobCancelledError()

  const controller = new AbortController()
  const timeoutError = new Error(`Job excedeu timeout de ${options.timeoutMs} ms.`)
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? Math.max(1_000, Math.min(30_000, Math.floor(options.leaseMs / 3)))
  let timeout: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  try {
    const context = {
      signal: controller.signal,
      heartbeat: () => heartbeatJob(repository, job.id, workerId, options.now(), options.leaseMs),
      isCancelled: () => isJobCancelled(repository, job.id),
    }
    heartbeatTimer = setInterval(() => {
      context.heartbeat().then((renewed) => {
        if (!renewed && !controller.signal.aborted) controller.abort(new JobCancelledError())
      }).catch((error) => {
        if (!controller.signal.aborted) controller.abort(error)
      })
    }, heartbeatIntervalMs)

    const operation = Promise.resolve().then(() => handler(job, context))
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort(timeoutError)
          reject(timeoutError)
        }, options.timeoutMs)
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
      }),
    ])
    if (await context.isCancelled()) throw new JobCancelledError()
  } finally {
    if (timeout) clearTimeout(timeout)
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  }
}
