import { getPrisma } from '../../lib/prisma'
import { getJobsConfig, readJobsEnvironment } from './config'
import { drainJobs } from './runner'

async function main() {
  const config = getJobsConfig(readJobsEnvironment())
  const result = await drainJobs(getPrisma(), {
    batchSize: config.batchSize,
    lockTimeoutMs: config.lockTimeoutMs,
    workerId: `once-${process.pid}`,
  })
  console.log(JSON.stringify(result))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
