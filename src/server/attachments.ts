import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { StorageDriver } from './storage'

const ALLOWED_EXACT_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
])

/** `audio/*` já entra aqui porque a Fase 4 recebe áudio pelo mesmo endpoint. */
const ALLOWED_TYPE_PREFIXES = ['image/', 'audio/']

export const attachmentTargetSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  taskId: z.string().trim().min(1).optional(),
}).strict().refine(
  (value) => Boolean(value.projectId || value.taskId),
  'Informe projectId ou taskId para vincular o anexo.',
)

export type AttachmentUpload = {
  filename: string
  contentType: string
  bytes: Uint8Array
}

export type AttachmentRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  attachment: {
    create(args: any): Promise<{ id: string; storageKey: string; filename: string; contentType: string; sizeBytes: number }>
    findFirst(args: any): Promise<{ id: string; storageKey: string; filename: string; contentType: string; sizeBytes: number } | null>
    delete(args: any): Promise<unknown>
  }
}

export type CreateAttachmentResult =
  | { kind: 'created'; attachment: { id: string; storageKey: string; filename: string; contentType: string; sizeBytes: number } }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'target-not-found' }
  | { kind: 'too-large' }
  | { kind: 'unsupported-type' }

export function isAllowedContentType(contentType: string) {
  const normalized = contentType.split(';')[0]!.trim().toLowerCase()
  return ALLOWED_EXACT_TYPES.has(normalized) || ALLOWED_TYPE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export async function createAttachment(
  repository: AttachmentRepository,
  storage: StorageDriver,
  ownerId: string,
  target: unknown,
  upload: AttachmentUpload,
  limits: { maxUploadBytes: number },
): Promise<CreateAttachmentResult> {
  const parsed = attachmentTargetSchema.safeParse(target)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }

  const filename = upload.filename.trim()
  if (!filename) return { kind: 'invalid', issues: ['Nome do arquivo é obrigatório.'] }
  if (upload.bytes.byteLength === 0) return { kind: 'invalid', issues: ['Arquivo vazio.'] }
  if (upload.bytes.byteLength > limits.maxUploadBytes) return { kind: 'too-large' }
  if (!isAllowedContentType(upload.contentType)) return { kind: 'unsupported-type' }

  const owned = await findOwnedTarget(repository, ownerId, parsed.data)
  if (!owned) return { kind: 'target-not-found' }

  const storageKey = `${ownerId}/${randomUUID()}`
  await storage.put(storageKey, upload.bytes)

  try {
    const attachment = await repository.attachment.create({
      data: {
        projectId: owned.projectId ?? null,
        taskId: owned.taskId ?? null,
        storageKey,
        filename,
        contentType: upload.contentType,
        sizeBytes: upload.bytes.byteLength,
      },
    })
    return { kind: 'created', attachment }
  } catch (error) {
    // Sem a linha o objeto ficaria órfão no storage e nunca seria apagado.
    await storage.delete(storageKey).catch(() => undefined)
    throw error
  }
}

export async function readAttachment(
  repository: AttachmentRepository,
  storage: StorageDriver,
  ownerId: string,
  attachmentId: string,
) {
  const attachment = await findOwnedAttachment(repository, ownerId, attachmentId)
  if (!attachment) return null
  const bytes = await storage.read(attachment.storageKey)
  if (!bytes) return null
  return { attachment, bytes }
}

export async function deleteAttachment(
  repository: AttachmentRepository,
  storage: StorageDriver,
  ownerId: string,
  attachmentId: string,
) {
  const attachment = await findOwnedAttachment(repository, ownerId, attachmentId)
  if (!attachment) return null
  await repository.attachment.delete({ where: { id: attachment.id } })
  await storage.delete(attachment.storageKey)
  return attachment
}

function findOwnedAttachment(repository: AttachmentRepository, ownerId: string, attachmentId: string) {
  return repository.attachment.findFirst({
    where: {
      id: attachmentId,
      OR: [{ project: { ownerId } }, { task: { project: { ownerId } } }],
    },
  })
}

async function findOwnedTarget(
  repository: AttachmentRepository,
  ownerId: string,
  target: { projectId?: string; taskId?: string },
) {
  if (target.taskId) {
    const task = await repository.task.findFirst({
      where: { id: target.taskId, project: { ownerId } },
      select: { id: true },
    })
    if (!task) return null
    if (!target.projectId) return { taskId: task.id }
  }
  if (target.projectId) {
    const project = await repository.project.findFirst({
      where: { id: target.projectId, ownerId },
      select: { id: true },
    })
    if (!project) return null
    return { projectId: project.id, taskId: target.taskId }
  }
  return null
}
