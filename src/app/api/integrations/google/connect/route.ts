import { randomBytes, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { authorizationUrl, googleConfig } from '../../../../../server/google-calendar'
import { withMcpOwner } from '../../../../../server/mcp/with-owner'
export const dynamic = 'force-dynamic'
export const GET = withMcpOwner(async ({ ownerId }) => {
  const config = googleConfig()
  const state = randomBytes(32).toString('base64url')
  const prisma = getPrisma()
  await prisma.googleOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  await prisma.googleOAuthState.create({ data: { stateHash: createHash('sha256').update(state).digest('hex'), ownerId, expiresAt: new Date(Date.now() + 10 * 60_000) } })
  return NextResponse.redirect(authorizationUrl(config, state))
})
