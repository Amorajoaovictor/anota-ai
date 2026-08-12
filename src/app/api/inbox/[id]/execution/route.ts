import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '../../../../../lib/prisma'
import { startApprovedHarnessProposal } from '../../../../../server/ai/harness/executor'
import { createPrismaHarnessExecutionRepository } from '../../../../../server/ai/harness/prisma-executor'
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

const executionSchema = z.object({
  proposalRevisionId: z.string().trim().min(1),
  targetHash: z.string().trim().min(1),
  expectedVersion: z.number().int().nonnegative(),
  selectedItemIds: z.array(z.string().trim().min(1)).max(100),
}).strict()

export const POST = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const parsed = executionSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    throw new ValidationError('Aprovação da proposta inválida.', parsed.error.issues.map((issue) => issue.message))
  }
  const { id: inboxItemId } = await context.params
  const prisma = getPrisma()
  const state = await getHarnessReadModel(prisma, ownerId, inboxItemId)
  if (state.kind === 'not-found') throw new NotFoundError()

  const result = await startApprovedHarnessProposal(createPrismaHarnessExecutionRepository(prisma), {
    ownerId,
    aiRunId: state.harness.id,
    proposalRevisionId: parsed.data.proposalRevisionId,
    targetHash: parsed.data.targetHash,
    selectedItemIds: parsed.data.selectedItemIds,
    expectedRunVersion: parsed.data.expectedVersion,
  })
  if (result.kind === 'not-found') throw new NotFoundError()
  if (result.kind === 'failed') throw new Error('Falha transacional ao iniciar proposta.')
  if (result.kind === 'blocked') {
    if (result.code === 'INVALID_PROPOSAL' || result.code === 'INVALID_GRAPH') {
      throw new UnprocessableEntityError('Proposta inconsistente.', [result.code])
    }
    throw new ConflictError(result.code)
  }

  return NextResponse.json(
    { executionId: result.executionId, entityIds: result.entityIds ?? [] },
    { status: result.kind === 'already-executed' ? 200 : 202 },
  )
})
