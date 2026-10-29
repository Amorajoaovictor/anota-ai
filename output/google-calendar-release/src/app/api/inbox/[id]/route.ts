import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '../../../../lib/prisma'
import { discardInboxItem } from '../../../../server/inbox'
import { NotFoundError, readJsonBody, ValidationError } from '../../../../server/http'
import { recordAuditEvent } from '../../../../server/audit-log'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/** Único jeito de editar uma entrada pela API é descartá-la; a proposta em si só grava no confirm. */
const patchSchema = z.object({ status: z.literal('Descartada') }).strict()

export const PATCH = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const { id } = await context.params
  const input = await readJsonBody(request)
  const parsed = patchSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados inválidos.', parsed.error.issues.map((issue) => issue.message))

  const result = await discardInboxItem(getPrisma(), ownerId, id)
  if (result.kind === 'not-found') throw new NotFoundError('Entrada não encontrada.')

  await recordAuditEvent({ actorId: ownerId, action: 'inbox.discarded', entityType: 'InboxItem', entityId: id })
  return NextResponse.json({ inboxItem: result.inboxItem })
})
