import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { ConflictError, readJsonBody, ValidationError } from '../../../server/http'
import { createProject, listProjects } from '../../../server/projects'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const projects = await listProjects(getPrisma(), ownerId)
  return NextResponse.json({ projects })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const result = await createProject(getPrisma(), ownerId, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'duplicate') throw new ConflictError('Já existe um projeto com este nome.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'project.created',
    entityType: 'Project',
    entityId: (result.project as { id?: string }).id,
    metadata: { name: (result.project as { name?: string }).name },
  })
  return NextResponse.json({ project: result.project }, { status: 201 })
})
