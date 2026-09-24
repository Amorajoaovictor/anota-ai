import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { readJsonBody, ValidationError } from '../../../../server/http'
import { createMcpToken, mcpTokenInputSchema } from '../../../../server/mcp/tokens'
import { withMcpOwner } from '../../../../server/mcp/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withMcpOwner(async ({ ownerId }) => {
  const tokens = await getPrisma().mcpToken.findMany({
    where: { ownerId },
    select: { id: true, name: true, scopes: true, expiresAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ tokens })
})

export const POST = withMcpOwner(async ({ ownerId, request }) => {
  const parsed = mcpTokenInputSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ValidationError('Token MCP inválido.', parsed.error.issues.map((issue) => issue.message))
  const result = await createMcpToken(getPrisma(), ownerId, parsed.data)
  await recordAuditEvent({ actorId: ownerId, action: 'mcp.token.created', entityType: 'McpToken', entityId: result.record.id,
    metadata: { name: result.record.name, scopes: result.record.scopes },
  })
  return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
})
