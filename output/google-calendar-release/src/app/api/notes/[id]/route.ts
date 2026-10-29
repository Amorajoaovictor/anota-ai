import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { removeNote, updateNote } from '../../../../server/notes'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await updateNote(getPrisma(), ownerId, id, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found') throw new NotFoundError('Nota não encontrada.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'note.updated',
    entityType: 'Note',
    entityId: id,
    // Nota é privada: registra o que mudou, não o texto.
    metadata: { changed: Object.keys(input as object) },
  })
  return NextResponse.json({ note: result.note })
})

export const DELETE = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const result = await removeNote(getPrisma(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Nota não encontrada.')

  await recordAuditEvent({ actorId: ownerId, action: 'note.removed', entityType: 'Note', entityId: id })
  return NextResponse.json({ removed: true })
})
