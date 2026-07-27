import { z } from 'zod'

const prioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Nome do projeto é obrigatório.'),
  description: z.string().trim().optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve usar hexadecimal de seis dígitos.').optional().default('#68d7a7'),
  priority: prioritySchema.optional().default('P3'),
}).strict()

const projectInclude = {
  aliases: true,
  modules: true,
  _count: { select: { tasks: true, milestones: true } },
} as const

type ProjectListRepository = {
  project: {
    findMany(args: any): Promise<unknown>
  }
}

type ProjectCreateRepository = {
  project: {
    create(args: any): Promise<unknown>
  }
}

export async function listProjects(repository: ProjectListRepository, ownerId: string) {
  return repository.project.findMany({
    where: { ownerId },
    orderBy: { updatedAt: 'desc' },
    include: projectInclude,
  })
}

export type CreateProjectResult =
  | { kind: 'created'; project: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'duplicate' }

export async function createProject(
  repository: ProjectCreateRepository,
  ownerId: string,
  input: unknown,
): Promise<CreateProjectResult> {
  const parsed = projectInputSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  try {
    const project = await repository.project.create({
      data: { ownerId, ...parsed.data },
      include: projectInclude,
    })
    return { kind: 'created', project }
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) return { kind: 'duplicate' }
    throw error
  }
}

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
