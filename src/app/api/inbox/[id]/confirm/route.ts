import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { confirmInboxItem } from '../../../../../server/inbox'
import { ConflictError, NotFoundError, readJsonBody, ValidationError } from '../../../../../server/http'
import { recordAuditEvent } from '../../../../../server/audit-log'
import { withOwner } from '../../../../../server/with-owner'
import { executeApprovedAiPlan } from '../../../../../server/ai/plan-executor'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const POST = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  if (isAiPlan(input)) {
    const result = await getPrisma().$transaction((transaction) => executeApprovedAiPlan(transaction, ownerId, id, input))
    if (result.kind === 'invalid') throw new ValidationError('Plano da IA inválido.', result.issues)
    if (result.kind === 'not-found') throw new NotFoundError('Entrada não encontrada.')
    if (result.kind === 'not-ready') throw new ConflictError('Entrada ainda não tem proposta para confirmar.')
    if (result.kind === 'already-executed') return NextResponse.json({ inboxItem: result.inboxItem, created: [] })

    await recordAuditEvent({
      actorId: ownerId,
      action: 'inbox.plan.executed',
      entityType: 'InboxItem',
      entityId: id,
      metadata: { created: result.created },
    })
    return NextResponse.json({ inboxItem: result.inboxItem, created: result.created }, { status: 201 })
  }

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

function isAiPlan(input: unknown): input is { actions: unknown[] } {
  return typeof input === 'object' && input !== null && 'actions' in input && Array.isArray(input.actions)
}
