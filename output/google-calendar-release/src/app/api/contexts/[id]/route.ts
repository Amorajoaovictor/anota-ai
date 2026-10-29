import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { removeContext, updateContext } from '../../../../server/contexts'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await updateContext(getPrisma(), ownerId, id, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found') throw new NotFoundError('Contexto não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'context.updated',
    entityType: 'ProjectContext',
    entityId: id,
    metadata: { changed: Object.keys(input as object) },
  })
  return NextResponse.json({ context: result.context })
})

export const DELETE = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await removeContext(getPrisma(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Contexto não encontrado.')

  await recordAuditEvent({ actorId: ownerId, action: 'context.removed', entityType: 'ProjectContext', entityId: id })
  return NextResponse.json({ removed: true })
})
