import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { getHarnessReadModel } from '../../../../../server/ai/harness/read-model'
import { NotFoundError } from '../../../../../server/http'
import { withOwner } from '../../../../../server/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export const GET = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await getHarnessReadModel(getPrisma(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError()
  return NextResponse.json({ harness: result.harness })
})
