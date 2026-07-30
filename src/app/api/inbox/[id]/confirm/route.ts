import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { confirmInboxItem } from '../../../../../server/inbox'
import { ConflictError, NotFoundError, readJsonBody, ValidationError } from '../../../../../server/http'
import { recordAuditEvent } from '../../../../../server/audit-log'
import { withOwner } from '../../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const POST = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await confirmInboxItem(getPrisma(), ownerId, id, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found') throw new NotFoundError('Entrada não encontrada.')
  if (result.kind === 'project-not-found') throw new ValidationError('Projeto não encontrado.')
  if (result.kind === 'not-ready') throw new ConflictError('Entrada ainda não tem proposta para confirmar.')
  if (result.kind === 'already-confirmed') return NextResponse.json({ inboxItem: result.inboxItem, task: null })

  await recordAuditEvent({
    actorId: ownerId,
    action: 'inbox.confirmed',
    entityType: 'InboxItem',
    entityId: id,
    metadata: { taskId: (result.task as { id?: string }).id },
  })
  return NextResponse.json({ inboxItem: result.inboxItem, task: result.task }, { status: 201 })
})
