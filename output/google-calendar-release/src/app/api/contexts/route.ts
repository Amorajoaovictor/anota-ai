import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../server/audit-log'
import { NotFoundError, readJsonBody, ValidationError } from '../../../server/http'
import { createContext, listContexts } from '../../../server/contexts'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const contexts = await listContexts(getPrisma(), ownerId)
  return NextResponse.json({ contexts })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const result = await createContext(getPrisma(), ownerId, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'project-not-found') throw new NotFoundError('Projeto não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'context.created',
    entityType: 'ProjectContext',
    entityId: (result.context as { id?: string }).id,
    metadata: { title: (result.context as { title?: string }).title },
  })
  return NextResponse.json({ context: result.context }, { status: 201 })
})
