import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { captureHarnessText } from '../../../server/ai/harness/capture'
import { isHarnessEnabledForOwner, readHarnessV2Config } from '../../../server/ai/harness/config'
import { captureInboxText, listInboxItems } from '../../../server/inbox'
import { PayloadTooLargeError, readJsonBody, ValidationError } from '../../../server/http'
import { drainJobs } from '../../../server/jobs/runner'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const GET = withOwner(async ({ ownerId }) => {
  const inbox = await listInboxItems(getPrisma(), ownerId)
  return NextResponse.json({ inbox })
})

export const POST = withOwner(async ({ ownerId, request }) => {
  const input = await readJsonBody(request)
  const harnessConfig = readHarnessV2Config(process.env)
  if (isHarnessEnabledForOwner(harnessConfig, ownerId)) {
    const result = await captureHarnessText(getPrisma() as any, ownerId, input, {
      maxCharacters: harnessConfig.maxMarkdownCharacters,
      organizationTimeoutMs: harnessConfig.timeouts.organizationMs,
      // Contagem conservadora central: nunca subestima caracteres multibyte.
      countTokens: (text) => Array.from(text).length,
    })
    if (result.kind === 'invalid') throw new ValidationError('Dados invalidos.', result.issues)
    if (result.kind === 'too-large') throw new PayloadTooLargeError('Texto acima do limite do harness.')
    triggerInlineDrain()
    return NextResponse.json({
      inboxItem: { ...result.inboxItem, aiRuns: [{ id: result.aiRun.id }] },
      aiRun: result.aiRun,
    }, { status: 201 })
  }

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
