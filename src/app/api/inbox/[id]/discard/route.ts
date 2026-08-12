import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { discardHarnessRun } from '../../../../../server/ai/harness/orchestration'
import { ConflictError, NotFoundError } from '../../../../../server/http'
import { getStorage } from '../../../../../server/storage'
import { withOwner } from '../../../../../server/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export const POST = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await discardHarnessRun(getPrisma() as any, getStorage(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Entrada nao encontrada.')
  if (result.kind === 'not-allowed') throw new ConflictError('Run processado nao pode ser descartado.')
  if (result.kind === 'stale') throw new ConflictError('Run mudou durante o descarte. Recarregue e tente novamente.')
  if (result.kind === 'already-discarded') {
    return NextResponse.json({ run: result.run, audioCleanupFailures: 0 })
  }
  return NextResponse.json({ run: result.run, audioCleanupFailures: result.audioCleanupFailures })
})
