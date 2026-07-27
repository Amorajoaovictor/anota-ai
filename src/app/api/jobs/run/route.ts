import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { toErrorResponse, NotFoundError, UnauthorizedError } from '../../../../server/http'
import { isValidRunnerToken } from '../../../../server/jobs/auth'
import { getJobsConfig, readJobsEnvironment } from '../../../../server/jobs/config'
import { drainJobs } from '../../../../server/jobs/runner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const config = getJobsConfig(readJobsEnvironment())
    // Sem token configurado o endpoint não existe: nada de execução anônima da fila.
    if (!config.runnerToken) throw new NotFoundError('Execução de fila não habilitada.')
    if (!isValidRunnerToken(config.runnerToken, request.headers.get('x-jobs-token'))) {
      throw new UnauthorizedError('Token da fila inválido.')
    }

    const result = await drainJobs(getPrisma(), {
      batchSize: config.batchSize,
      lockTimeoutMs: config.lockTimeoutMs,
      workerId: 'http-runner',
    })
    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
