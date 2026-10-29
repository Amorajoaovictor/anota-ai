import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../server/http'
import { createMeeting, listMeetings } from '../../../server/meetings'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => NextResponse.json({ meetings: await listMeetings(getPrisma(), ownerId) }))

export const POST = withOwner(async ({ ownerId, request }) => {
  const result = await createMeeting(getPrisma(), ownerId, await readJsonBody(request))
  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'project-not-found') throw new NotFoundError('Projeto não encontrado.')
  const meeting = result.meeting as { id?: string; projectId?: string | null }
  await recordAuditEvent({ actorId: ownerId, action: 'meeting.created', entityType: 'Meeting', entityId: meeting.id, metadata: { projectId: meeting.projectId ?? null } })
  return NextResponse.json({ meeting: result.meeting }, { status: 201 })
})
