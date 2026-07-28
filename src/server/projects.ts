import { z } from 'zod'

const prioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Nome do projeto é obrigatório.'),
  description: z.string().trim().optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve usar hexadecimal de seis dígitos.').optional().default('#68d7a7'),
  priority: prioritySchema.optional().default('P3'),
}).strict()

const nameList = z.array(z.string().trim().min(1)).max(50)
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve usar hexadecimal de seis dígitos.')
const tagList = z.array(z.object({
  name: z.string().trim().min(1, 'Nome da etiqueta é obrigatório.'),
  color: colorSchema.optional(),
}).strict()).max(50)

export const projectPatchSchema = z.object({
  name: z.string().trim().min(1, 'Nome do projeto é obrigatório.').optional(),
  description: z.string().trim().optional(),
  color: colorSchema.optional(),
  priority: prioritySchema.optional(),
  archived: z.boolean().optional(),
  aliases: nameList.optional(),
  modules: nameList.optional(),
  tags: tagList.optional(),
}).strict()

const projectInclude = {
  aliases: true,
  modules: true,
  tags: true,
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

type ProjectUpdateRepository = {
  project: {
    findFirst(args: any): Promise<{ id: string } | null>
    update(args: any): Promise<unknown>
  }
  projectModule: {
    findMany(args: any): Promise<{ name: string }[]>
  }
  projectTag: {
    findMany(args: any): Promise<{ name: string }[]>
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

export type UpdateProjectResult =
  | { kind: 'updated'; project: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }
  | { kind: 'duplicate' }

/**
 * Aliases, módulos e etiquetas são editados como lista na tela, então a semântica
 * é de conjunto: o que não vier no payload sai. Módulo e etiqueta com card
 * vinculado são a exceção — apagá-los desligaria o card, então permanecem.
 */
export async function updateProject(
  repository: ProjectUpdateRepository,
  ownerId: string,
  projectId: string,
  input: unknown,
): Promise<UpdateProjectResult> {
  const parsed = projectPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  }

  const owned = await repository.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } })
  if (!owned) return { kind: 'not-found' }

  const { archived, aliases, modules, tags, ...fields } = parsed.data
  const data: Record<string, unknown> = { ...fields }
  if (archived !== undefined) data.status = archived ? 'ARCHIVED' : 'ACTIVE'
  if (aliases) {
    data.aliases = { deleteMany: {}, create: unique(aliases).map((value) => ({ value })) }
  }
  if (modules) {
    const names = unique(modules)
    // `deleteMany` aninhado só aceita filtro escalar, então quais módulos podem sair
    // é decidido antes, em uma consulta que enxerga a relação com os cards.
    const removable = await repository.projectModule.findMany({
      where: { projectId, name: { notIn: names }, tasks: { none: {} } },
      select: { name: true },
    })
    data.modules = {
      deleteMany: { name: { in: removable.map((module) => module.name) } },
      upsert: names.map((name) => ({
        where: { projectId_name: { projectId, name } },
        create: { name },
        update: {},
      })),
    }
  }
  if (tags) {
    const wanted = uniqueTags(tags)
    const names = wanted.map((tag) => tag.name)
    const removable = await repository.projectTag.findMany({
      where: { projectId, name: { notIn: names }, tasks: { none: {} } },
      select: { name: true },
    })
    data.tags = {
      deleteMany: { name: { in: removable.map((tag) => tag.name) } },
      upsert: wanted.map((tag) => ({
        where: { projectId_name: { projectId, name: tag.name } },
        // Etiqueta que já existe só troca de cor quando a tela informa uma.
        create: tag.color ? { name: tag.name, color: tag.color } : { name: tag.name },
        update: tag.color ? { color: tag.color } : {},
      })),
    }
  }

  try {
    const project = await repository.project.update({
      where: { id: projectId },
      data,
      include: projectInclude,
    })
    return { kind: 'updated', project }
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) return { kind: 'duplicate' }
    throw error
  }
}

/** Repetição só de caixa entra uma vez, mantendo a primeira grafia digitada. */
function unique(values: string[]) {
  const seen = new Map<string, string>()
  values.forEach((value) => {
    const key = value.toLocaleLowerCase()
    if (!seen.has(key)) seen.set(key, value)
  })
  return [...seen.values()]
}

function uniqueTags(tags: { name: string; color?: string }[]) {
  const seen = new Map<string, { name: string; color?: string }>()
  tags.forEach((tag) => {
    const key = tag.name.toLocaleLowerCase()
    if (!seen.has(key)) seen.set(key, tag)
  })
  return [...seen.values()]
}

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
