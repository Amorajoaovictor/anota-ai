import { Prisma } from '@prisma/client'
import { redactAuditMetadata, type AuditMetadata } from '../lib/audit'
import { getPrisma } from '../lib/prisma'

type AuditEvent = {
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  metadata?: AuditMetadata
}

export async function recordAuditEvent(event: AuditEvent) {
  const metadata = event.metadata && redactAuditMetadata(event.metadata)
  return getPrisma().auditLog.create({
    data: {
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue : undefined,
    },
  })
}
