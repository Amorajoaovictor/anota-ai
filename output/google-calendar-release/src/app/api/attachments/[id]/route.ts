import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../lib/prisma'
import { deleteAttachment, readAttachment } from '../../../../server/attachments'
import { recordAuditEvent } from '../../../../server/audit-log'
import { NotFoundError } from '../../../../server/http'
import { getStorage } from '../../../../server/storage'
import { withOwner } from '../../../../server/with-owner'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const found = await readAttachment(getPrisma(), getStorage(), ownerId, id)
  if (!found) throw new NotFoundError('Anexo não encontrado.')

  return new NextResponse(found.bytes as unknown as BodyInit, {
    headers: {
      'content-type': found.attachment.contentType,
      'content-length': String(found.attachment.sizeBytes),
      'content-disposition': `attachment; filename="${encodeURIComponent(found.attachment.filename)}"`,
      'cache-control': 'private, no-store',
    },
  })
})

export const DELETE = withOwner<RouteContext>(async ({ ownerId, context }) => {
  const { id } = await context.params
  const attachment = await deleteAttachment(getPrisma(), getStorage(), ownerId, id)
  if (!attachment) throw new NotFoundError('Anexo não encontrado.')

  await recordAuditEvent({
    actorId: ownerId,
    action: 'attachment.deleted',
    entityType: 'Attachment',
    entityId: attachment.id,
    metadata: { filename: attachment.filename },
  })

  return NextResponse.json({ deleted: attachment.id })
})
