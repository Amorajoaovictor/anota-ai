import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { removeMeeting, updateMeeting } from '../../../../server/meetings'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'
type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await updateMeeting(getPrisma(), ownerId, id, input)
  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found' || result.kind === 'project-not-found') throw new NotFoundError(result.kind === 'not-found' ? 'Reunião não encontrada.' : 'Projeto não encontrado.')
  await recordAuditEvent({ actorId: ownerId, action: 'meeting.updated', entityType: 'Meeting', entityId: id, metadata: { changed: Object.keys(input as object) } })
  return NextResponse.json({ meeting: result.meeting })
})

export const DELETE = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await removeMeeting(getPrisma(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Reunião não encontrada.')
  await recordAuditEvent({ actorId: ownerId, action: 'meeting.removed', entityType: 'Meeting', entityId: id })
  return NextResponse.json({ removed: true })
})
