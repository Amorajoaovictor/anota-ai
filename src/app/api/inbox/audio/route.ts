import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { captureHarnessAudio } from '../../../../server/ai/harness/capture'
import { isHarnessEnabledForOwner, readHarnessV2Config } from '../../../../server/ai/harness/config'
import { captureInboxAudio } from '../../../../server/inbox'
import { PayloadTooLargeError, ValidationError } from '../../../../server/http'
import { drainJobs } from '../../../../server/jobs/runner'
import { getMaxUploadBytes, getStorage } from '../../../../server/storage'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const POST = withOwner(async ({ ownerId, request }) => {
  const form = await readFormData(request)
  const file = form.get('file')
  if (!(file instanceof File)) throw new ValidationError('Envie o áudio no campo "file".')
  const caption = readField(form, 'text')

  const storage = getStorage()
  const storageLimits = { maxUploadBytes: getMaxUploadBytes() }
  const harnessConfig = readHarnessV2Config(process.env)
  if (isHarnessEnabledForOwner(harnessConfig, ownerId)) {
    const result = await captureHarnessAudio(
      getPrisma() as any,
      storage,
      ownerId,
      {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        bytes: new Uint8Array(await file.arrayBuffer()),
        caption,
      },
      {
        maxUploadBytes: Math.min(storageLimits.maxUploadBytes, harnessConfig.maxAudioBytes),
        transcriptionTimeoutMs: harnessConfig.timeouts.transcriptionMs,
      },
    )
    if (result.kind === 'invalid') throw new ValidationError('Dados invalidos.', result.issues)
    if (result.kind === 'too-large') throw new PayloadTooLargeError()
    if (result.kind === 'unsupported-type') throw new ValidationError('Envie um arquivo de audio suportado.')

    drainJobs(getPrisma(), { batchSize: 5 }).catch(() => undefined)
    return NextResponse.json({
      inboxItem: { ...result.inboxItem, aiRuns: [{ id: result.aiRun.id }] },
      aiRun: result.aiRun,
    }, { status: 201 })
  }

  const result = await captureInboxAudio(
    getPrisma(),
    storage,
    ownerId,
    {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
      caption,
    },
    storageLimits,
  )

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'too-large') throw new PayloadTooLargeError()
  if (result.kind === 'unsupported-type') throw new ValidationError('Envie um arquivo de áudio.')

  drainJobs(getPrisma(), { batchSize: 5 }).catch(() => undefined)
  return NextResponse.json({ inboxItem: result.inboxItem }, { status: 201 })
})

function readField(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function readFormData(request: Request) {
  try {
    return await request.formData()
  } catch {
    throw new ValidationError('Envio precisa ser multipart/form-data.')
  }
}
