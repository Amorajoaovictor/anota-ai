import { z } from 'zod'

const statusSchema = z.enum(['BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELED'])
const kindSchema = z.enum(['TASK', 'BUG', 'IMPROVEMENT', 'FEATURE', 'DECISION', 'EXTERNAL_REQUEST', 'FUTURE_IDEA', 'QUESTION'])
const prioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])
const complexitySchema = z.number().int().min(1).max(3).nullable()
const dueSchema = z.string().datetime().nullable()
/** Texto livre: a tela cria módulo enquanto digita, sem cadastro prévio. */
const moduleNameSchema = z.string().trim().max(80)
const idList = z.array(z.string().trim().min(1)).max(50)

export const taskInputSchema = z.object({
  projectId: z.string().trim().min(1, 'Projeto é obrigatório.'),
  title: z.string().trim().min(1, 'Título do card é obrigatório.'),
  description: z.string().trim().optional().default(''),
  moduleName: moduleNameSchema.optional(),
  kind: kindSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueAt: dueSchema.optional(),
  forecastAt: dueSchema.optional(),
  complexity: complexitySchema.optional(),
  milestoneIds: idList.optional(),
  tagIds: idList.optional(),
  /** Nota de origem, quando o card nasce de "Converter em card". */
  sourceNoteId: z.string().trim().min(1).nullable().optional(),
}).strict()

export const taskPatchSchema = z.object({
  title: z.string().trim().min(1, 'Título do card é obrigatório.').optional(),
  description: z.string().trim().optional(),
  moduleName: moduleNameSchema.optional(),
  kind: kindSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueAt: dueSchema.optional(),
  forecastAt: dueSchema.optional(),
  complexity: complexitySchema.optional(),
  dependsOnIds: idList.optional(),
  milestoneIds: idList.optional(),
  tagIds: idList.optional(),
}).strict()

const taskInclude = {
  project: true,
  module: true,
  milestones: { include: { milestone: true } },
  tags: { include: { tag: true } },
  dependsOn: true,
} as const

type TaskListRepository = {
  task: { findMany(args: any): Promise<unknown> }
}

/**
 * Marco, etiqueta e dependência só valem dentro do projeto do card, então todas
 * as três precisam de uma consulta de filtragem antes da escrita.
 */
type TaskLinkRepository = {
  milestone: { findMany(args: any): Promise<{ id: string }[]> }
  projectTag: { findMany(args: any): Promise<{ id: string }[]> }
}

type TaskCreateRepository = TaskLinkRepository & {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  note: { findFirst(args: any): Promise<{ id: string } | null> }
  task: { create(args: any): Promise<unknown> }
}

type TaskUpdateRepository = TaskLinkRepository & {
  task: {
    findFirst(args: any): Promise<{ id: string; projectId: string } | null>
    findMany(args: any): Promise<{ id: string }[]>
    update(args: any): Promise<unknown>
  }
}

type TaskHistoryRepository = {
  task: { findFirst(args: any): Promise<{ id: string } | null> }
  auditLog: { findMany(args: any): Promise<unknown> }
}

export async function listTasks(repository: TaskListRepository, ownerId: string) {
  return repository.task.findMany({
    where: { project: { ownerId } },
    orderBy: { updatedAt: 'desc' },
    include: taskInclude,
  })
}

export type CreateTaskResult =
  | { kind: 'created'; task: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'project-not-found' }

export async function createTask(
  repository: TaskCreateRepository,
  ownerId: string,
  input: unknown,
): Promise<CreateTaskResult> {
  const parsed = taskInputSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const project = await repository.project.findFirst({
    where: { id: parsed.data.projectId, ownerId },
    select: { id: true },
  })
  if (!project) return { kind: 'project-not-found' }

  const { projectId, moduleName, milestoneIds, tagIds, sourceNoteId, ...fields } = parsed.data
  const [milestones, tags, sourceNote] = await Promise.all([
    ownedLinkIds((args) => repository.milestone.findMany(args), project.id, milestoneIds),
    ownedLinkIds((args) => repository.projectTag.findMany(args), project.id, tagIds),
    // Nota de outro dono, inexistente ou já convertida não vira origem: `sourceNoteId`
    // é único, e insistir derrubaria a criação por conflito.
    sourceNoteId
      ? repository.note.findFirst({ where: { id: sourceNoteId, ownerId, convertedTask: { is: null } }, select: { id: true } })
      : Promise.resolve(null),
  ])

  const task = await repository.task.create({
    data: {
      // Relação em vez de `projectId` escalar: misturar os dois estilos joga o
      // Prisma no modo "unchecked", que proíbe o `connectOrCreate` do módulo.
      project: { connect: { id: project.id } },
      ...fields,
      // Defaults da Fase 0 do PRD; o que a tela informar prevalece.
      status: fields.status ?? 'BACKLOG',
      priority: fields.priority ?? 'P3',
      kind: fields.kind ?? 'TASK',
      ...(moduleName ? moduleLink(project.id, moduleName) : {}),
      ...(milestones.length ? { milestones: { create: milestones.map((id) => ({ milestoneId: id })) } } : {}),
      ...(tags.length ? { tags: { create: tags.map((id) => ({ tagId: id })) } } : {}),
      ...(sourceNote ? { sourceNote: { connect: { id: sourceNote.id } } } : {}),
    },
    include: taskInclude,
  })
  return { kind: 'created', task }
}

export type UpdateTaskResult =
  | { kind: 'updated'; task: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }

/**
 * Dependência, marco e etiqueta só existem dentro do projeto do card: ids fora do
 * projeto — ou de outro dono — são descartados em vez de derrubar a edição inteira,
 * mesma regra de `setTaskMilestones` no domínio.
 */
export async function updateTask(
  repository: TaskUpdateRepository,
  ownerId: string,
  taskId: string,
  input: unknown,
): Promise<UpdateTaskResult> {
  const parsed = taskPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const task = await repository.task.findFirst({
    where: { id: taskId, project: { ownerId } },
    select: { id: true, projectId: true },
  })
  if (!task) return { kind: 'not-found' }

  const { moduleName, dependsOnIds, milestoneIds, tagIds, ...fields } = parsed.data
  const data: Record<string, unknown> = { ...fields, ...moduleLink(task.projectId, moduleName) }

  if (dependsOnIds) {
    const wanted = [...new Set(dependsOnIds)].filter((id) => id !== taskId)
    const valid = wanted.length
      ? await repository.task.findMany({
        where: { id: { in: wanted }, projectId: task.projectId, project: { ownerId } },
        select: { id: true },
      })
      : []
    data.dependsOn = { deleteMany: {}, create: valid.map((item) => ({ dependsOnId: item.id })) }
  }

  if (milestoneIds) {
    const valid = await ownedLinkIds((args) => repository.milestone.findMany(args), task.projectId, milestoneIds)
    data.milestones = { deleteMany: {}, create: valid.map((id) => ({ milestoneId: id })) }
  }

  if (tagIds) {
    const valid = await ownedLinkIds((args) => repository.projectTag.findMany(args), task.projectId, tagIds)
    data.tags = { deleteMany: {}, create: valid.map((id) => ({ tagId: id })) }
  }

  const updated = await repository.task.update({ where: { id: taskId }, data, include: taskInclude })
  return { kind: 'updated', task: updated }
}

/** Ids que existem dentro do projeto informado, sem repetição e na ordem recebida. */
async function ownedLinkIds(
  findMany: (args: any) => Promise<{ id: string }[]>,
  projectId: string,
  ids: string[] | undefined,
): Promise<string[]> {
  const wanted = [...new Set(ids ?? [])]
  if (!wanted.length) return []
  const found = await findMany({ where: { id: { in: wanted }, projectId }, select: { id: true } })
  const valid = new Set(found.map((item) => item.id))
  return wanted.filter((id) => valid.has(id))
}

/** Histórico do card = trilha de auditoria já gravada por `recordAuditEvent`. */
export async function getTaskHistory(repository: TaskHistoryRepository, ownerId: string, taskId: string) {
  const task = await repository.task.findFirst({
    where: { id: taskId, project: { ownerId } },
    select: { id: true },
  })
  if (!task) return null
  return repository.auditLog.findMany({
    where: { entityType: 'Task', entityId: taskId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

/** Módulo vazio desliga o vínculo; nome novo cria a linha dentro do projeto. */
function moduleLink(projectId: string, moduleName: string | undefined) {
  if (moduleName === undefined) return {}
  if (!moduleName) return { module: { disconnect: true } }
  return {
    module: {
      connectOrCreate: {
        where: { projectId_name: { projectId, name: moduleName } },
        create: { name: moduleName, project: { connect: { id: projectId } } },
      },
    },
  }
}
