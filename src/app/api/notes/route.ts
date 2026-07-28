import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../server/http'
import { createNote, listNotes } from '../../../server/notes'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const notes = await listNotes(getPrisma(), ownerId)
  return NextResponse.json({ notes })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const result = await createNote(getPrisma(), ownerId, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'project-not-found') throw new NotFoundError('Projeto não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'note.created',
    entityType: 'Note',
    entityId: (result.note as { id?: string }).id,
    // Nota é privada: só o vínculo é auditado, nunca o conteúdo.
    metadata: { projectId: (result.note as { projectId?: string }).projectId },
  })
  return NextResponse.json({ note: result.note }, { status: 201 })
})
