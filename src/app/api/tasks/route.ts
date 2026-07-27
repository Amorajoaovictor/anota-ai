import { NextResponse } from 'next/server'
import { requireCurrentUserId } from '../../../lib/auth/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { createTask, listTasks } from '../../../server/tasks'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ownerId = await requireCurrentUserId()
    const tasks = await listTasks(getPrisma(), ownerId)
    return NextResponse.json({ tasks })
  } catch (error) {
    return authorizationOrServerError(error)
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireCurrentUserId()
    const input = await request.json()
    const result = await createTask(getPrisma(), ownerId, input)

    if (result.kind === 'invalid') {
      return NextResponse.json({ error: 'Dados inválidos.', issues: result.issues }, { status: 400 })
    }
    if (result.kind === 'project-not-found') {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    await recordAuditEvent({
      actorId: ownerId,
      action: 'task.created',
      entityType: 'Task',
      entityId: (result.task as { id?: string }).id,
      metadata: { title: (result.task as { title?: string }).title },
    })
    return NextResponse.json({ task: result.task }, { status: 201 })
  } catch (error) {
    return authorizationOrServerError(error)
  }
}

function authorizationOrServerError(error: unknown) {
  if (error instanceof Error && error.message === 'Não autenticado.') {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }
  return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
}
