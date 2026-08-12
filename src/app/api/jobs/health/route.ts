import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { readHarnessV2Config } from '../../../../server/ai/harness/config'
import { buildHarnessOperationalHealth } from '../../../../server/ai/harness/metrics'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const health = await buildHarnessOperationalHealth(getPrisma() as any, ownerId, readHarnessV2Config(process.env))
  return NextResponse.json({ health })
})
