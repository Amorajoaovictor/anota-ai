import { NextResponse } from 'next/server'
import { getPrisma } from '../../../lib/prisma'
import { createAttachment } from '../../../server/attachments'
import { recordAuditEvent } from '../../../server/audit-log'
import { NotFoundError, PayloadTooLargeError, ValidationError } from '../../../server/http'
import { getMaxUploadBytes, getStorage } from '../../../server/storage'
import { withOwner } from '../../../server/with-owner'

export const dynamic = 'force-dynamic'

export const POST = withOwner(async ({ ownerId, request }) => {
  const form = await readFormData(request)
  const file = form.get('file')
  if (!(file instanceof File)) throw new ValidationError('Envie o arquivo no campo "file".')

  const target = {
    ...(readField(form, 'projectId') ? { projectId: readField(form, 'projectId') } : {}),
    ...(readField(form, 'taskId') ? { taskId: readField(form, 'taskId') } : {}),
  }

  const result = await createAttachment(
    getPrisma(),
    getStorage(),
    ownerId,
    target,
    {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
    },
    { maxUploadBytes: getMaxUploadBytes() },
  )

  if (result.kind === 'invalid') throw new ValidationError('Dados inválidos.', result.issues)
  if (result.kind === 'too-large') throw new PayloadTooLargeError()
  if (result.kind === 'unsupported-type') throw new ValidationError('Tipo de arquivo não permitido.')
  if (result.kind === 'target-not-found') throw new NotFoundError('Projeto ou card não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'attachment.created',
    entityType: 'Attachment',
    entityId: result.attachment.id,
    metadata: {
      filename: result.attachment.filename,
      contentType: result.attachment.contentType,
      sizeBytes: result.attachment.sizeBytes,
    },
  })

  return NextResponse.json({ attachment: result.attachment }, { status: 201 })
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
