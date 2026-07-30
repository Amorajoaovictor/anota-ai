import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { enqueue, type JobRepository } from './jobs/queue'
import type { StorageDriver } from './storage'
import {
  complexitySchema,
  createTask,
  dueSchema,
  kindSchema,
  moduleNameSchema,
  prioritySchema,
  type TaskCreateRepository,
} from './tasks'

/**
 * Persistência da caixa de entrada (PRD 12.2/12.3). Captura enfileira o
 * classificador (`ai.classify`/`audio.transcribe` — ver `jobs/handlers.ts`);
 * nada aqui chama IA diretamente, então trocar de provedor não muda este arquivo.
 */

export const inboxCaptureSchema = z.object({
  text: z.string().trim().min(1, 'Texto da entrada é obrigatório.').max(4000),
}).strict()

export const confirmInboxInputSchema = z.object({
  projectId: z.string().trim().min(1, 'Projeto é obrigatório.'),
  title: z.string().trim().min(1, 'Título do card é obrigatório.'),
  moduleName: moduleNameSchema.optional(),
  kind: kindSchema.optional(),
  priority: prioritySchema.optional(),
  complexity: complexitySchema.optional(),
  dueAt: dueSchema.optional(),
  forecastAt: dueSchema.optional(),
  /** Nomes de tag: os que não existirem no projeto são criados na confirmação (PRD "criação automática de tags"). */
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
}).strict()

export type InboxUpload = {
  filename: string
  contentType: string
  bytes: Uint8Array
  /** Legenda opcional digitada junto do áudio; a transcrição é anexada depois dela. */
  caption?: string
}

type InboxListRepository = {
  inboxItem: { findMany(args: any): Promise<unknown[]> }
}

type InboxCaptureRepository = JobRepository & {
  inboxItem: { create(args: any): Promise<{ id: string }> }
}

// `Omit` evita que o `inboxItem`/`projectTag` mais estreitos de `TaskCreateRepository`
// (usados só para validar `sourceInboxId`/`tagIds`) colidam por interseção com os
// métodos mais completos que a confirmação precisa aqui.
type InboxConfirmRepository = Omit<TaskCreateRepository, 'inboxItem' | 'projectTag'> & {
  inboxItem: {
    findFirst(args: any): Promise<{ id: string; status: string; suggestion: unknown } | null>
    update(args: any): Promise<unknown>
  }
  projectTag: {
    findMany(args: any): Promise<{ id: string }[]>
    upsert(args: any): Promise<{ id: string }>
  }
}

export function listInboxItems(repository: InboxListRepository, ownerId: string) {
  return repository.inboxItem.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  })
}

export type CaptureInboxResult =
  | { kind: 'created'; inboxItem: unknown }
  | { kind: 'invalid'; issues: string[] }

export async function captureInboxText(
  repository: InboxCaptureRepository,
  ownerId: string,
  input: unknown,
): Promise<CaptureInboxResult> {
  const parsed = inboxCaptureSchema.safeParse(input)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }

  const inboxItem = await repository.inboxItem.create({
    data: { ownerId, source: 'TEXT', status: 'RECEIVED', text: parsed.data.text },
  })
  await enqueue(repository, { type: 'ai.classify', payload: { inboxItemId: inboxItem.id } })
  return { kind: 'created', inboxItem }
}

export type CaptureInboxAudioResult =
  | { kind: 'created'; inboxItem: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'too-large' }
  | { kind: 'unsupported-type' }

export async function captureInboxAudio(
  repository: InboxCaptureRepository,
  storage: StorageDriver,
  ownerId: string,
  upload: InboxUpload,
  limits: { maxUploadBytes: number },
): Promise<CaptureInboxAudioResult> {
  if (upload.bytes.byteLength === 0) return { kind: 'invalid', issues: ['Arquivo de áudio vazio.'] }
  if (upload.bytes.byteLength > limits.maxUploadBytes) return { kind: 'too-large' }
  if (!upload.contentType.split(';')[0]!.trim().toLowerCase().startsWith('audio/')) return { kind: 'unsupported-type' }

  // Áudio da inbox é efêmero — nunca vira linha em `Attachment`, só passa pelo storage até a transcrição apagar (PRD 19.3).
  const storageKey = `inbox-audio/${ownerId}/${randomUUID()}`
  await storage.put(storageKey, upload.bytes)

  try {
    const inboxItem = await repository.inboxItem.create({
      data: { ownerId, source: 'AUDIO', status: 'TRANSCRIBING', text: upload.caption?.trim() ?? '' },
    })
    await enqueue(repository, {
      type: 'audio.transcribe',
      payload: { inboxItemId: inboxItem.id, storageKey, contentType: upload.contentType },
    })
    return { kind: 'created', inboxItem }
  } catch (error) {
    // Sem a linha o áudio ficaria órfão no storage e nunca seria apagado.
    await storage.delete(storageKey).catch(() => undefined)
    throw error
  }
}

export type ConfirmInboxResult =
  | { kind: 'confirmed'; inboxItem: unknown; task: unknown }
  | { kind: 'already-confirmed'; inboxItem: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }
  | { kind: 'not-ready' }
  | { kind: 'project-not-found' }

export async function confirmInboxItem(
  repository: InboxConfirmRepository,
  ownerId: string,
  inboxId: string,
  input: unknown,
): Promise<ConfirmInboxResult> {
  const item = await repository.inboxItem.findFirst({
    where: { id: inboxId, ownerId },
    select: { id: true, status: true, suggestion: true },
  })
  if (!item) return { kind: 'not-found' }
  // Confirmar duas vezes não duplica card: `sourceInboxId` é único no banco, então repetir só devolve o estado atual.
  if (item.status === 'PROCESSED') return { kind: 'already-confirmed', inboxItem: item }
  if (item.status !== 'AWAITING_CONFIRMATION' || !item.suggestion) return { kind: 'not-ready' }

  const parsed = confirmInboxInputSchema.safeParse(input)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }

  const project = await repository.project.findFirst({
    where: { id: parsed.data.projectId, ownerId },
    select: { id: true },
  })
  if (!project) return { kind: 'project-not-found' }

  const { tags, ...taskFields } = parsed.data
  const tagIds = tags?.length ? await upsertTags(repository, project.id, tags) : []

  const created = await createTask(repository, ownerId, {
    ...taskFields,
    status: 'BACKLOG',
    tagIds,
    sourceInboxId: inboxId,
  })
  if (created.kind === 'invalid') return { kind: 'invalid', issues: created.issues }
  if (created.kind === 'project-not-found') return { kind: 'project-not-found' }

  const updated = await repository.inboxItem.update({ where: { id: inboxId }, data: { status: 'PROCESSED' } })
  return { kind: 'confirmed', inboxItem: updated, task: created.task }
}

export type DiscardInboxResult = { kind: 'discarded'; inboxItem: unknown } | { kind: 'not-found' }

export async function discardInboxItem(
  repository: { inboxItem: { findFirst(args: any): Promise<{ id: string } | null>; update(args: any): Promise<unknown> } },
  ownerId: string,
  inboxId: string,
): Promise<DiscardInboxResult> {
  const item = await repository.inboxItem.findFirst({ where: { id: inboxId, ownerId }, select: { id: true } })
  if (!item) return { kind: 'not-found' }
  const inboxItem = await repository.inboxItem.update({ where: { id: inboxId }, data: { status: 'DISCARDED' } })
  return { kind: 'discarded', inboxItem }
}

/** Cria a tag que ainda não existe no projeto e devolve o id de todas (novas e já existentes). */
async function upsertTags(repository: InboxConfirmRepository, projectId: string, names: string[]): Promise<string[]> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const tags = await Promise.all(unique.map((name) => repository.projectTag.upsert({
    where: { projectId_name: { projectId, name } },
    create: { projectId, name },
    update: {},
    select: { id: true },
  })))
  return tags.map((tag) => tag.id)
}
