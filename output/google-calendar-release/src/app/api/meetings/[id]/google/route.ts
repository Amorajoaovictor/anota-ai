import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { scheduleGoogleMeeting } from '../../../../../server/google-meetings'
import { withMcpOwner } from '../../../../../server/mcp/with-owner'
import { NotFoundError, ValidationError } from '../../../../../server/http'
export const dynamic = 'force-dynamic'
export const POST = withMcpOwner<{ params: Promise<{ id: string }> }>(async ({ ownerId, context, requestId }) => {
  const { id } = await context.params
  const result = await scheduleGoogleMeeting(getPrisma(), ownerId, id, requestId)
  if (result.kind === 'not-found') throw new NotFoundError('Reunião não encontrada.')
  if (result.kind === 'not-ready') throw new ValidationError('Conecte Google Calendar em Integrações.')
  await getPrisma().auditLog.create({ data: { actorId: ownerId, action: 'meeting.google.scheduled', entityType: 'Meeting', entityId: id, metadata: { requestId, conferenceStatus: result.conferenceStatus } } })
  return NextResponse.json(result)
})
