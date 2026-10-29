import { z } from 'zod'

/**
 * Nota privada: pertence a um projeto do dono e, opcionalmente, a um card desse
 * mesmo projeto. Fica fora de IA e MCP por decisão da Fase 0 — nenhuma consulta
 * aqui é exposta ao agente.
 */

const titleSchema = z.string().trim().max(200)
const contentSchema = z.string().trim().min(1, 'Conteúdo da nota é obrigatório.')

export const noteInputSchema = z.object({
  projectId: z.string().trim().min(1, 'Projeto é obrigatório.'),
  taskId: z.string().trim().min(1).nullable().optional(),
  title: titleSchema.optional().default(''),
  content: contentSchema,
  pinned: z.boolean().optional(),
  position: z.number().finite().optional(),
}).strict()

export const notePatchSchema = z.object({
  taskId: z.string().trim().min(1).nullable().optional(),
  title: titleSchema.optional(),
  content: contentSchema.optional(),
  pinned: z.boolean().optional(),
  position: z.number().finite().optional(),
}).strict()

const noteInclude = { convertedTask: { select: { id: true } } } as const

type NoteListRepository = {
  note: { findMany(args: any): Promise<unknown> }
}

type NoteCreateRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  note: { create(args: any): Promise<unknown> }
}

type NoteUpdateRepository = {
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  note: {
    findFirst(args: any): Promise<{ id: string; projectId: string } | null>
    update(args: any): Promise<unknown>
    delete(args: any): Promise<unknown>
  }
}

export async function listNotes(repository: NoteListRepository, ownerId: string) {
  return repository.note.findMany({
    where: { ownerId },
    orderBy: { position: 'asc' },
    include: noteInclude,
  })
}

export type CreateNoteResult =
  | { kind: 'created'; note: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'project-not-found' }

export async function createNote(
  repository: NoteCreateRepository,
  ownerId: string,
  input: unknown,
): Promise<CreateNoteResult> {
  const parsed = noteInputSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const project = await repository.project.findFirst({
    where: { id: parsed.data.projectId, ownerId },
    select: { id: true },
  })
  if (!project) return { kind: 'project-not-found' }

  const { projectId, taskId, title, content, ...fields } = parsed.data
  const note = await repository.note.create({
    data: {
      ownerId,
      projectId: project.id,
      taskId: await validTaskId(repository, project.id, taskId),
      // Nota sem título recebe o começo do conteúdo, igual ao domínio.
      title: title || fallbackTitle(content),
      content,
      ...fields,
    },
    include: noteInclude,
  })
  return { kind: 'created', note }
}

export type UpdateNoteResult =
  | { kind: 'updated'; note: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }

export async function updateNote(
  repository: NoteUpdateRepository,
  ownerId: string,
  noteId: string,
  input: unknown,
): Promise<UpdateNoteResult> {
  const parsed = notePatchSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const note = await repository.note.findFirst({ where: { id: noteId, ownerId }, select: { id: true, projectId: true } })
  if (!note) return { kind: 'not-found' }

  const { taskId, title, content, ...fields } = parsed.data
  const data: Record<string, unknown> = { ...fields }
  if (content !== undefined) data.content = content
  if (title !== undefined) data.title = title || fallbackTitle(content ?? '')
  // Card fora do projeto da nota não vira vínculo; `null` desfaz o vínculo atual.
  if (taskId !== undefined) data.taskId = await validTaskId(repository, note.projectId, taskId)

  const updated = await repository.note.update({ where: { id: noteId }, data, include: noteInclude })
  return { kind: 'updated', note: updated }
}

export type RemoveNoteResult = { kind: 'removed' } | { kind: 'not-found' }

export async function removeNote(
  repository: NoteUpdateRepository,
  ownerId: string,
  noteId: string,
): Promise<RemoveNoteResult> {
  const note = await repository.note.findFirst({ where: { id: noteId, ownerId }, select: { id: true, projectId: true } })
  if (!note) return { kind: 'not-found' }
  await repository.note.delete({ where: { id: noteId } })
  return { kind: 'removed' }
}

async function validTaskId(
  repository: { task: { findFirst(args: any): Promise<{ id: string } | null> } },
  projectId: string,
  taskId: string | null | undefined,
): Promise<string | null> {
  if (!taskId) return null
  const task = await repository.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } })
  return task?.id ?? null
}

function fallbackTitle(content: string) {
  return content.length > 72 ? `${content.slice(0, 69)}...` : content
}
