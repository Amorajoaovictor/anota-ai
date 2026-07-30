import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { captureInboxText, listInboxItems } from '../../../server/inbox'
import { readJsonBody, ValidationError } from '../../../server/http'
import { drainJobs } from '../../../server/jobs/runner'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const inbox = await listInboxItems(getPrisma(), ownerId)
  return NextResponse.json({ inbox })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const result = await captureInboxText(getPrisma(), ownerId, input)

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)

  triggerInlineDrain()
  return NextResponse.json({ inboxItem: result.inboxItem }, { status: 201 })
})

/**
 * Sem worker dedicado rodando neste ambiente, o job ficaria pendente até alguém
 * bater em `/api/jobs/run` ou rodar `npm run worker`. Este disparo é só uma
 * conveniência de DX — best-effort, nunca bloqueia nem falha a resposta — e não
 * substitui o worker/cron real em produção.
 */
function triggerInlineDrain() {
  drainJobs(getPrisma(), { batchSize: 5 }).catch(() => undefined)
}
