import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '../../../../../lib/prisma'
import { appendUserProposalRevision } from '../../../../../server/ai/harness/proposal-persistence'
import { harnessProposalV1Schema } from '../../../../../server/ai/harness/contracts'
import { getHarnessReadModel } from '../../../../../server/ai/harness/read-model'
import {
  ConflictError,
  NotFoundError,
  readJsonBody,
  UnprocessableEntityError,
  ValidationError,
} from '../../../../../server/http'
import { withOwner } from '../../../../../server/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

const draftSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  proposal: harnessProposalV1Schema,
  selectedItemIds: z.array(z.string().trim().min(1)).max(100),
}).strict()

export const PUT = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const parsed = draftSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ValidationError('Draft da proposta invalido.', parsed.error.issues.map((issue) => issue.message))
  const { id: inboxItemId } = await context.params
  const state = await getHarnessReadModel(getPrisma(), ownerId, inboxItemId)
  if (state.kind === 'not-found') throw new NotFoundError()

  const result = await appendUserProposalRevision(getPrisma() as any, ownerId, state.harness.id, parsed.data)
  if (result.kind === 'not-found') throw new NotFoundError()
  if (result.kind === 'stale-version' || result.kind === 'invalid-state') throw new ConflictError('STALE_VERSION')
  if (result.kind === 'invalid') throw new UnprocessableEntityError('Proposta inconsistente.', result.issues)
  return NextResponse.json({ revision: result.revision }, { status: 201 })
})
