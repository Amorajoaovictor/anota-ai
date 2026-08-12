import { z } from 'zod'

/**
 * Contexto de projeto: o oposto da nota privada. Exige projeto, pode apontar um
 * card do mesmo projeto e fica disponível para IA e MCP (Fase 0). Título e
 * conteúdo são obrigatórios — contexto sem afirmação não serve para classificar.
 */

const titleSchema = z.string().trim().min(1, 'Título do contexto é obrigatório.').max(200)
const contentSchema = z.string().trim().min(1, 'Conteúdo do contexto é obrigatório.')
export const contextCategorySchema = z.enum(['FACT', 'DECISION', 'RULE', 'VOCABULARY', 'MEETING'])

export const contextInputSchema = z.object({
  projectId: z.string().trim().min(1, 'Projeto é obrigatório.'),
  taskId: z.string().trim().min(1).nullable().optional(),
  title: titleSchema,
  content: contentSchema,
  category: contextCategorySchema.optional(),
}).strict()

export const contextPatchSchema = z.object({
  taskId: z.string().trim().min(1).nullable().optional(),
  title: titleSchema.optional(),
  content: contentSchema.optional(),
}).strict()

type ContextListRepository = {
  projectContext: { findMany(args: any): Promise<unknown> }
}

type ContextCreateRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  projectContext: { create(args: any): Promise<unknown> }
}

type ContextUpdateRepository = {
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  projectContext: {
    findFirst(args: any): Promise<{ id: string; projectId: string } | null>
    update(args: any): Promise<unknown>
    delete(args: any): Promise<unknown>
  }
}

export async function listContexts(repository: ContextListRepository, ownerId: string) {
  return repository.projectContext.findMany({
    where: { project: { ownerId } },
    orderBy: { createdAt: 'desc' },
  })
}

export type CreateContextResult =
  | { kind: 'created'; context: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'project-not-found' }

export async function createContext(
  repository: ContextCreateRepository,
  ownerId: string,
  input: unknown,
): Promise<CreateContextResult> {
  const parsed = contextInputSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const project = await repository.project.findFirst({
    where: { id: parsed.data.projectId, ownerId },
    select: { id: true },
  })
  if (!project) return { kind: 'project-not-found' }

  const context = await repository.projectContext.create({
    data: {
      projectId: project.id,
      taskId: await validTaskId(repository, project.id, parsed.data.taskId),
      title: parsed.data.title,
      content: parsed.data.content,
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
    },
  })
  return { kind: 'created', context }
}

export type UpdateContextResult =
  | { kind: 'updated'; context: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }

export async function updateContext(
  repository: ContextUpdateRepository,
  ownerId: string,
  contextId: string,
  input: unknown,
): Promise<UpdateContextResult> {
  const parsed = contextPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const context = await repository.projectContext.findFirst({
    where: { id: contextId, project: { ownerId } },
    select: { id: true, projectId: true },
  })
  if (!context) return { kind: 'not-found' }

  const { taskId, ...fields } = parsed.data
  const data: Record<string, unknown> = { ...fields }
  if (taskId !== undefined) data.taskId = await validTaskId(repository, context.projectId, taskId)

  const updated = await repository.projectContext.update({ where: { id: contextId }, data })
  return { kind: 'updated', context: updated }
}

export type RemoveContextResult = { kind: 'removed' } | { kind: 'not-found' }

export async function removeContext(
  repository: ContextUpdateRepository,
  ownerId: string,
  contextId: string,
): Promise<RemoveContextResult> {
  const context = await repository.projectContext.findFirst({
    where: { id: contextId, project: { ownerId } },
    select: { id: true, projectId: true },
  })
  if (!context) return { kind: 'not-found' }
  await repository.projectContext.delete({ where: { id: contextId } })
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
