import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { retryHarnessRun } from '../../../../../server/ai/harness/orchestration'
import { ConflictError, NotFoundError } from '../../../../../server/http'
import { withOwner } from '../../../../../server/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export const POST = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await retryHarnessRun(getPrisma() as any, ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Entrada nao encontrada.')
  if (result.kind === 'not-retryable') throw new ConflictError('Run nao permite retry neste estado.')
  if (result.kind === 'stale') throw new ConflictError('Run mudou durante o retry. Recarregue e tente novamente.')
  return NextResponse.json({ run: result.run, job: result.job })
})
