import { z } from 'zod'

export const taskInputSchema = z.object({
  projectId: z.string().trim().min(1, 'Projeto é obrigatório.'),
  title: z.string().trim().min(1, 'Título do card é obrigatório.'),
  description: z.string().trim().optional().default(''),
}).strict()

const taskInclude = {
  project: true,
  module: true,
  milestones: { include: { milestone: true } },
} as const

type TaskListRepository = {
  task: { findMany(args: any): Promise<unknown> }
}

type TaskCreateRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  task: { create(args: any): Promise<unknown> }
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

  const task = await repository.task.create({
    data: {
      projectId: project.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: 'BACKLOG',
      priority: 'P3',
      kind: 'TASK',
    },
    include: taskInclude,
  })
  return { kind: 'created', task }
}
