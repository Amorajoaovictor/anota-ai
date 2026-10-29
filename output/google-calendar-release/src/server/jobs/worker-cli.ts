import { getPrisma } from '../../lib/prisma'
import { getJobsConfig, readJobsEnvironment } from './config'
import { drainJobs } from './runner'

const config = getJobsConfig(readJobsEnvironment())
const workerId = `cli-${process.pid}`
let running = true

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

function stop() {
  running = false
}

async function main() {
  console.log(`worker iniciado (${workerId}), intervalo ${config.pollIntervalMs}ms`)
  while (running) {
    try {
      const result = await drainJobs(getPrisma(), {
        batchSize: config.batchSize,
        lockTimeoutMs: config.lockTimeoutMs,
        workerId,
      })
      if (result.claimed || result.released) console.log('worker', result)
    } catch (error) {
      console.error('worker falhou ao drenar fila:', error)
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs))
  }
  console.log('worker encerrado')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
