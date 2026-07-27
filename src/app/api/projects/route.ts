import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { requireCurrentUserId } from '../../../lib/auth/server'
import { recordAuditEvent } from '../../../server/audit-log'
import { createProject, listProjects } from '../../../server/projects'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ownerId = await requireCurrentUserId()
    const projects = await listProjects(getPrisma(), ownerId)
    return NextResponse.json({ projects })
  } catch (error) {
    return authorizationOrServerError(error)
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireCurrentUserId()
    const input = await request.json()
    const result = await createProject(getPrisma(), ownerId, input)

    if (result.kind === 'invalid') {
      return NextResponse.json({ error: 'Dados inválidos.', issues: result.issues }, { status: 400 })
    }
    if (result.kind === 'duplicate') {
      return NextResponse.json({ error: 'Já existe um projeto com este nome.' }, { status: 409 })
    }

    await recordAuditEvent({
      actorId: ownerId,
      action: 'project.created',
      entityType: 'Project',
      entityId: (result.project as { id?: string }).id,
      metadata: { name: (result.project as { name?: string }).name },
    })
    return NextResponse.json({ project: result.project }, { status: 201 })
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
