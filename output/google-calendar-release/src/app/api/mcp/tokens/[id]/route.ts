import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { recordAuditEvent } from '../../../../../server/audit-log'
import { NotFoundError } from '../../../../../server/http'
import { revokeMcpToken } from '../../../../../server/mcp/tokens'
import { withMcpOwner } from '../../../../../server/mcp/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

export const DELETE = withMcpOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  if (!await revokeMcpToken(getPrisma(), ownerId, id)) throw new NotFoundError('Token MCP não encontrado.')
  await recordAuditEvent({ actorId: ownerId, action: 'mcp.token.revoked', entityType: 'McpToken', entityId: id })
  return NextResponse.json({ revoked: true })
})
