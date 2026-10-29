import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { recordAuditEvent } from '../../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { getTaskHistory, updateTask } from '../../../../server/tasks'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const history = await getTaskHistory(getPrisma(), ownerId, id)
  if (!history) throw new NotFoundError('Card não encontrado.')
  return NextResponse.json({ history })
})

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const result = await updateTask(getPrisma(), ownerId, id, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'not-found') throw new NotFoundError('Card não encontrado.')

  const changed = Object.keys(input as object)
  await recordAuditEvent({
    actorId: ownerId,
    // Mover no Kanban é a única alteração de status isolada; separar dá um histórico legível.
    action: changed.length === 1 && changed[0] === 'status' ? 'task.moved' : 'task.updated',
    entityType: 'Task',
    entityId: id,
    metadata: { changed, ...(input as object) },
  })
  return NextResponse.json({ task: result.task })
})
