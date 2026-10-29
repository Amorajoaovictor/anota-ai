import { after } from 'next/server'
import { getPrisma } from '../../lib/prisma'
import { isHarnessEnabledForOwner, readHarnessV2Config } from '../ai/harness/config'
import { getJobsConfig, readJobsEnvironment } from './config'
import { drainJobs } from './runner'

const HARNESS_DRAIN_BATCH_SIZE = 100

/**
 * Produção não mantém o worker CLI. Após uma aprovação do harness, drena somente
 * a fila do owner autorizado. O cron continua como recuperação de jobs pendentes.
 */
export function scheduleHarnessJobsDrain(ownerId: string, environment = process.env) {
  if (!shouldScheduleHarnessJobsDrain(ownerId, environment)) return

  after(async () => {
    try {
      const jobsConfig = getJobsConfig(readJobsEnvironment())
      await drainJobs(getPrisma(), {
        ownerId,
        workerId: `harness-owner-${ownerId}`,
        batchSize: Math.max(jobsConfig.batchSize, HARNESS_DRAIN_BATCH_SIZE),
        lockTimeoutMs: jobsConfig.lockTimeoutMs,
      })
    } catch (error) {
      console.error(JSON.stringify({
        event: 'harness.owner_queue_drain_failed',
        ownerId,
        error: serializeError(error),
      }))
    }
  })
}

export function shouldScheduleHarnessJobsDrain(ownerId: string, environment: Record<string, string | undefined>): boolean {
  if (environment.VERCEL_ENV !== 'production') return false
  return isHarnessEnabledForOwner(readHarnessV2Config(environment), ownerId)
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { name: 'NonError', message: String(error) }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error
      ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack }
      : error.cause,
  }
}
