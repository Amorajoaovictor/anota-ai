export type JobsConfig = {
  runnerToken: string | null
  batchSize: number
  lockTimeoutMs: number
  pollIntervalMs: number
}

export function readJobsEnvironment(): Record<string, string | undefined> {
  return {
    JOBS_RUNNER_TOKEN: process.env.JOBS_RUNNER_TOKEN,
    JOBS_BATCH_SIZE: process.env.JOBS_BATCH_SIZE,
    JOBS_LOCK_TIMEOUT_MS: process.env.JOBS_LOCK_TIMEOUT_MS,
    JOBS_POLL_INTERVAL_MS: process.env.JOBS_POLL_INTERVAL_MS,
  }
}

export function getJobsConfig(environment: Record<string, string | undefined>): JobsConfig {
  const runnerToken = environment.JOBS_RUNNER_TOKEN?.trim()
  return {
    runnerToken: runnerToken && runnerToken.length >= 16 ? runnerToken : null,
    batchSize: positiveNumber(environment.JOBS_BATCH_SIZE, 10),
    lockTimeoutMs: positiveNumber(environment.JOBS_LOCK_TIMEOUT_MS, 5 * 60_000),
    pollIntervalMs: positiveNumber(environment.JOBS_POLL_INTERVAL_MS, 1_000),
  }
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value?.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
