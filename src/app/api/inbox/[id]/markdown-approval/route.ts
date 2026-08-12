import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '../../../../../lib/prisma'
import { approveMarkdownSnapshot } from '../../../../../server/ai/harness/approvals'
import { getHarnessReadModel } from '../../../../../server/ai/harness/read-model'
import { ConflictError, NotFoundError, readJsonBody, ValidationError } from '../../../../../server/http'
import { withOwner } from '../../../../../server/with-owner'
import { readHarnessV2Config } from '../../../../../server/ai/harness/config'
import { assessHarnessInput } from '../../../../../server/ai/harness/budget'
import { UnprocessableEntityError } from '../../../../../server/http'

type RouteContext = { params: Promise<{ id: string }> }

const approvalSchema = z.object({
  revisionId: z.string().trim().min(1),
  targetHash: z.string().trim().min(1),
  expectedVersion: z.number().int().nonnegative(),
}).strict()

export const POST = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const parsed = approvalSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ValidationError('Aprovacao de Markdown invalida.', parsed.error.issues.map((issue) => issue.message))
  const { id: inboxItemId } = await context.params
  const state = await getHarnessReadModel(getPrisma(), ownerId, inboxItemId)
  if (state.kind === 'not-found') throw new NotFoundError()

  const config = readHarnessV2Config(process.env)
  const activeMarkdown = state.harness.markdown
  if (activeMarkdown?.id === parsed.data.revisionId && typeof activeMarkdown.content === 'string') {
    const assessment = assessHarnessInput(activeMarkdown.content, {
      ...config.materializerBudget,
      // Contagem conservadora enquanto o provedor não expõe tokenizer local.
      countTokens: (content) => Array.from(content).length,
    })
    if (!assessment.accepted) {
      throw new UnprocessableEntityError('Markdown acima do orçamento da materialização.', [
        assessment.code,
        `tokens=${assessment.tokens}`,
        `maximum=${assessment.maximumInputTokens}`,
      ])
    }
  }

  const result = await approveMarkdownSnapshot(getPrisma() as any, ownerId, state.harness.id, {
    ...parsed.data,
    retrievalTimeoutMs: config.timeouts.retrievalMs,
  })
  if (result.kind === 'not-found') throw new NotFoundError()
  if (result.kind === 'stale-version' || result.kind === 'hash-mismatch' || result.kind === 'invalid-state') {
    throw new ConflictError(result.kind === 'stale-version' ? 'STALE_VERSION' : 'APPROVAL_MISMATCH')
  }
  return NextResponse.json({ approval: result.approval }, { status: result.kind === 'approved' ? 201 : 200 })
})
