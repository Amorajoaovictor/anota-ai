import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../server/http'
import { createTask, listTasks } from '../../../server/tasks'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const tasks = await listTasks(getPrisma(), ownerId)
  return NextResponse.json({ tasks })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const result = await createTask(getPrisma(), ownerId, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'project-not-found') throw new NotFoundError('Projeto não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'task.created',
    entityType: 'Task',
    entityId: (result.task as { id?: string }).id,
    metadata: { title: (result.task as { title?: string }).title },
  })
  return NextResponse.json({ task: result.task }, { status: 201 })
})
