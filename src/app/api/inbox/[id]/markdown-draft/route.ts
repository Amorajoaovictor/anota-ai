import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '../../../../../lib/prisma'
import { readHarnessV2Config } from '../../../../../server/ai/harness/config'
import { appendMarkdownRevision } from '../../../../../server/ai/harness/persistence'
import { getHarnessReadModel } from '../../../../../server/ai/harness/read-model'
import { ConflictError, NotFoundError, readJsonBody, ValidationError } from '../../../../../server/http'
import { withOwner } from '../../../../../server/with-owner'

type RouteContext = { params: Promise<{ id: string }> }

const draftSchema = z.object({
  content: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
}).strict()

export const PUT = withOwner<RouteContext>(async ({ ownerId, request, context }) => {
  const parsed = draftSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ValidationError('Draft de Markdown invalido.', parsed.error.issues.map((issue) => issue.message))
  const config = readHarnessV2Config(process.env)
  if (Array.from(parsed.data.content).length > config.maxMarkdownCharacters) {
    throw new ValidationError('Markdown acima do limite configurado.')
  }

  const { id: inboxItemId } = await context.params
  const state = await getHarnessReadModel(getPrisma(), ownerId, inboxItemId)
  if (state.kind === 'not-found') throw new NotFoundError()

  const result = await appendMarkdownRevision(getPrisma() as any, ownerId, state.harness.id, {
    expectedVersion: parsed.data.expectedVersion,
    source: 'USER',
    content: parsed.data.content,
    // Contagem conservadora; o limite nunca e subestimado.
    tokenCount: Array.from(parsed.data.content).length,
  })
  if (result.kind === 'not-found') throw new NotFoundError()
  if (result.kind === 'stale-version') throw new ConflictError('STALE_VERSION')
  if (result.kind === 'invalid-state') throw new ConflictError('INVALID_STATE')
  return NextResponse.json({ revision: result.revision }, { status: 201 })
})
