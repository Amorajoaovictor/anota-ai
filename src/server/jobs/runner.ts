import { resolveHandler, UnknownJobTypeError, type JobHandler } from './handlers'
import { claimNext, completeJob, failJob, releaseStaleJobs, type JobRepository } from './queue'

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
  resolve?: (type: string) => JobHandler
  now?: () => Date
}

export async function drainJobs(repository: JobRepository, options: DrainOptions = {}): Promise<DrainResult> {
  const batchSize = options.batchSize ?? 10
  const workerId = options.workerId ?? `worker-${process.pid}`
  const resolve = options.resolve ?? resolveHandler
  const now = options.now ?? (() => new Date())

  const released = await releaseStaleJobs(repository, options.lockTimeoutMs ?? 5 * 60_000, now())
  const result: DrainResult = { claimed: 0, completed: 0, failed: 0, released: released.count }

  for (let processed = 0; processed < batchSize; processed += 1) {
    const job = await claimNext(repository, workerId, now())
    if (!job) break
    result.claimed += 1

    try {
      const handler = resolve(job.type)
      await handler(job)
      await completeJob(repository, job.id)
      result.completed += 1
    } catch (error) {
      // Tipo desconhecido não melhora com nova tentativa: falha direto e fica visível para inspeção.
      await failJob(repository, job, error, { retry: !(error instanceof UnknownJobTypeError), now: now() })
      result.failed += 1
    }
  }

  return result
}
