import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { ConflictError, NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { updateProject } from '../../../../server/projects'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await updateProject(getPrisma(), ownerId, id, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found') throw new NotFoundError('Projeto não encontrado.')
  if (result.kind === 'duplicate') throw new ConflictError('Já existe um projeto com este nome.')

  const archived = (input as { archived?: boolean }).archived
  await recordAuditEvent({
    actorId: ownerId,
    action: archived === undefined ? 'project.updated' : archived ? 'project.archived' : 'project.restored',
    entityType: 'Project',
    entityId: id,
    metadata: { changed: Object.keys(input as object) },
  })
  return NextResponse.json({ project: result.project })
})
