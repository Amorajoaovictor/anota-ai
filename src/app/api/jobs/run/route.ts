import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { toErrorResponse, NotFoundError, UnauthorizedError } from '../../../../server/http'
import { isValidRunnerToken } from '../../../../server/jobs/auth'
import { getJobsConfig, readJobsEnvironment } from '../../../../server/jobs/config'
import { drainJobs } from '../../../../server/jobs/runner'

export const dynamic = 'force-dynamic'

/**
 * Cron do Vercel chama GET com `Authorization: Bearer ${CRON_SECRET}`; sem o segredo o caminho
 * responde 404, porque a fila não pode drenar de forma anônima.
 */
export async function GET(request: Request) {
  return runQueue({
    expected: process.env.CRON_SECRET?.trim() || null,
    received: bearerToken(request),
    workerId: 'cron-runner',
  })
}

export async function POST(request: Request) {
  return runQueue({
    expected: getJobsConfig(readJobsEnvironment()).runnerToken,
    received: request.headers.get('x-jobs-token'),
    workerId: 'http-runner',
  })
}

async function runQueue(auth: { expected: string | null; received: string | null; workerId: string }) {
  try {
    const config = getJobsConfig(readJobsEnvironment())
    if (!auth.expected) throw new NotFoundError('Execução de fila não habilitada.')
    if (!isValidRunnerToken(auth.expected, auth.received)) {
      throw new UnauthorizedError('Token da fila inválido.')
    }

    const result = await drainJobs(getPrisma(), {
      batchSize: config.batchSize,
      lockTimeoutMs: config.lockTimeoutMs,
      workerId: auth.workerId,
    })
    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}
