import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
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

  const result = await captureInboxAudio(
    getPrisma(),
    getStorage(),
    ownerId,
    {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
      caption,
    },
    { maxUploadBytes: getMaxUploadBytes() },
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
