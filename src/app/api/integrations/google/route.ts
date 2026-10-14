import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { withMcpOwner } from '../../../../server/mcp/with-owner'
export const dynamic = 'force-dynamic'
export const GET = withMcpOwner(async ({ ownerId }) => {
  const connection = await getPrisma().googleCalendarConnection.findUnique({ where: { ownerId }, select: { scope: true } })
  return NextResponse.json({ connected: Boolean(connection), configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) })
})
