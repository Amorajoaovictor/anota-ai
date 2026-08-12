import { createTask } from '../tasks'
import { aiPlanSchema, orderAiPlanActions, type AiPlanAction } from './plan'

type Ref = { existingId: string } | { actionId: string }
type Created = { entity: AiPlanAction['entity']; id: string; projectId?: string }

/**
 * Executa somente plano já aprovado. Chamador deve envolver esta função em uma
 * transação: claim, entidades e status final precisam confirmar ou reverter juntos.
 */
export async function executeApprovedAiPlan(repository: any, ownerId: string, inboxId: string, input: unknown) {
  const item = await repository.inboxItem.findFirst({
    where: { id: inboxId, ownerId },
    select: { id: true, status: true, suggestion: true },
  })
  if (!item) return { kind: 'not-found' as const }
  if (item.status === 'PROCESSED') return { kind: 'already-executed' as const, inboxItem: item }
  if (item.status !== 'AWAITING_CONFIRMATION' || !item.suggestion) return { kind: 'not-ready' as const }

  const parsed = aiPlanSchema.safeParse(input)
  if (!parsed.success) return { kind: 'invalid' as const, issues: parsed.error.issues.map((issue) => issue.message) }
  const actions = orderAiPlanActions(parsed.data)
  const existingProjects = await preloadExistingProjects(repository, ownerId, actions)
  const existingTasks = await preloadExistingTasks(repository, ownerId, actions)

  const claimed = await repository.inboxItem.updateMany({
    where: { id: inboxId, ownerId, status: 'AWAITING_CONFIRMATION' },
    data: { status: 'ANALYZING' },
  })
  if (claimed.count !== 1) return { kind: 'already-executed' as const, inboxItem: item }

  const created = new Map<string, Created>()
  for (const action of actions) {
    const result = await executeAction(repository, ownerId, action, created, existingProjects, existingTasks)
    created.set(action.id, result)
  }

  const inboxItem = await repository.inboxItem.update({ where: { id: inboxId }, data: { status: 'PROCESSED' } })
  return { kind: 'executed' as const, inboxItem, created: [...created.entries()].map(([actionId, value]) => ({ actionId, ...value })) }
}

async function executeAction(
  repository: any,
  ownerId: string,
  action: AiPlanAction,
  created: Map<string, Created>,
  projects: Map<string, string>,
  tasks: Map<string, { id: string; projectId: string }>,
): Promise<Created> {
  if (action.entity === 'project') {
    const project = await repository.project.create({ data: { ownerId, ...action.data } })
    return { entity: action.entity, id: entityId(project, action.id), projectId: entityId(project, action.id) }
  }

  if (action.entity === 'dependency') {
    const task = resolveTask(action.data.task, created, tasks)
    const dependsOn = resolveTask(action.data.dependsOnTask, created, tasks)
    if (task.projectId !== dependsOn.projectId || task.id === dependsOn.id) throw new Error('Dependência exige duas tarefas diferentes do mesmo projeto.')
    await repository.taskDependency.upsert({
      where: { taskId_dependsOnId: { taskId: task.id, dependsOnId: dependsOn.id } },
      create: { taskId: task.id, dependsOnId: dependsOn.id },
      update: {},
    })
    return { entity: action.entity, id: `${task.id}:${dependsOn.id}`, projectId: task.projectId }
  }

  const projectId = resolveProject(action.data.project, created, projects)
  if (action.entity === 'context') {
    const task = action.data.task ? resolveTask(action.data.task, created, tasks) : null
    if (task && task.projectId !== projectId) throw new Error('Contexto só pode apontar para tarefa do mesmo projeto.')
    const context = await repository.projectContext.create({
      data: { projectId, taskId: task?.id ?? null, category: action.data.category, title: action.data.title, content: action.data.content },
    })
    return { entity: action.entity, id: entityId(context, action.id), projectId }
  }
  if (action.entity === 'task') {
    const { tags, ...taskData } = withoutProject(action.data)
    const tagIds = tags?.length
      ? await Promise.all([...new Set(tags)].map(async (name) => {
        const tag = await repository.projectTag.upsert({
          where: { projectId_name: { projectId, name } }, create: { projectId, name }, update: {}, select: { id: true },
        })
        return entityId(tag, name)
      }))
      : []
    const result = await createTask(repository, ownerId, { projectId, ...taskData, ...(tagIds.length ? { tagIds } : {}) })
    if (result.kind !== 'created') throw new Error(`Não foi possível criar tarefa: ${result.kind}.`)
    const task = result.task as { id?: string; projectId?: string }
    return { entity: action.entity, id: entityId(task, action.id), projectId }
  }
  if (action.entity === 'milestone') {
    const milestone = await repository.milestone.create({
      data: {
        projectId,
        name: action.data.name,
        description: action.data.description ?? '',
        targetAt: new Date(action.data.targetAt),
        startAt: action.data.startAt ? new Date(action.data.startAt) : null,
      },
    })
    return { entity: action.entity, id: entityId(milestone, action.id), projectId }
  }
  if (action.entity === 'alias') {
    const alias = await repository.projectAlias.upsert({
      where: { projectId_value: { projectId, value: action.data.value } },
      create: { projectId, value: action.data.value },
      update: {},
    })
    return { entity: action.entity, id: entityId(alias, action.id), projectId }
  }
  if (action.entity === 'module') {
    const module = await repository.projectModule.upsert({
      where: { projectId_name: { projectId, name: action.data.name } },
      create: { projectId, name: action.data.name }, update: {},
    })
    return { entity: action.entity, id: entityId(module, action.id), projectId }
  }
  const tag = await repository.projectTag.upsert({
    where: { projectId_name: { projectId, name: action.data.name } },
    create: { projectId, name: action.data.name, ...(action.data.color ? { color: action.data.color } : {}) },
    update: action.data.color ? { color: action.data.color } : {},
  })
  return { entity: action.entity, id: entityId(tag, action.id), projectId }
}

async function preloadExistingProjects(repository: any, ownerId: string, actions: AiPlanAction[]) {
  const ids = new Set<string>()
  actions.forEach((action) => {
    if ('project' in action.data && 'existingId' in action.data.project) ids.add(action.data.project.existingId)
  })
  const found = new Map<string, string>()
  for (const id of ids) {
    const project = await repository.project.findFirst({ where: { id, ownerId }, select: { id: true } })
    if (!project) throw new Error(`Projeto não encontrado ou sem acesso: ${id}.`)
    found.set(id, project.id)
  }
  return found
}

async function preloadExistingTasks(repository: any, ownerId: string, actions: AiPlanAction[]) {
  const ids = new Set<string>()
  const add = (ref: Ref | undefined) => { if (ref && 'existingId' in ref) ids.add(ref.existingId) }
  actions.forEach((action) => {
    if (action.entity === 'context') add(action.data.task)
    if (action.entity === 'dependency') { add(action.data.task); add(action.data.dependsOnTask) }
  })
  const found = new Map<string, { id: string; projectId: string }>()
  for (const id of ids) {
    const task = await repository.task.findFirst({ where: { id, project: { ownerId } }, select: { id: true, projectId: true } })
    if (!task) throw new Error(`Tarefa não encontrada ou sem acesso: ${id}.`)
    found.set(id, task)
  }
  return found
}

function resolveProject(ref: Ref, created: Map<string, Created>, existing: Map<string, string>) {
  if ('existingId' in ref) return existing.get(ref.existingId)!
  const value = created.get(ref.actionId)
  if (!value || value.entity !== 'project') throw new Error(`Referência ${ref.actionId} não aponta para projeto criado.`)
  return value.id
}

function resolveTask(ref: Ref, created: Map<string, Created>, existing: Map<string, { id: string; projectId: string }>) {
  if ('existingId' in ref) return existing.get(ref.existingId)!
  const value = created.get(ref.actionId)
  if (!value || value.entity !== 'task' || !value.projectId) throw new Error(`Referência ${ref.actionId} não aponta para tarefa criada.`)
  return { id: value.id, projectId: value.projectId }
}

function withoutProject<T extends { project: unknown }>(data: T): Omit<T, 'project'> {
  const { project: _project, ...rest } = data
  return rest
}

function entityId(entity: unknown, fallback: string) {
  return typeof entity === 'object' && entity !== null && 'id' in entity && typeof entity.id === 'string' ? entity.id : fallback
}
