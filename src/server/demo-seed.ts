import type { PrismaClient } from '@prisma/client'
import { initialState, type InboxItem, type Milestone, type Note, type ProjectContextEntry, type Task } from '../domain'
import { toDbComplexity, toDbDate, toDbDue, toDbKind, toDbMilestoneStatus, toDbStatus } from '../lib/mapping'

type DemoSeedClient = Pick<
  PrismaClient,
  'project' | 'projectAlias' | 'projectModule' | 'projectTag' | 'projectContext'
  | 'task' | 'taskDependency' | 'taskTag' | 'milestone' | 'taskMilestone' | 'note' | 'inboxItem'
>

const inboxSourceToDb = { Texto: 'TEXT', 'Áudio': 'AUDIO', Trello: 'TRELLO', MCP: 'MCP', Planilha: 'SPREADSHEET' } as const

const inboxStatusToDb = {
  Recebida: 'RECEIVED',
  Transcrevendo: 'TRANSCRIBING',
  'Analisando contexto': 'ANALYZING',
  'Aguardando confirmação': 'AWAITING_CONFIRMATION',
  Processada: 'PROCESSED',
  Descartada: 'DISCARDED',
  'Com erro': 'ERROR',
} as const

function moduleName(task: Task) {
  const name = task.module?.trim()
  return !name || name === 'Geral' ? null : name
}

async function seedProject(prisma: DemoSeedClient, ownerId: string, project: typeof initialState.projects[number]) {
  const data = { description: project.description, color: project.color, priority: project.priority, status: project.archived ? ('ARCHIVED' as const) : ('ACTIVE' as const) }
  const existing = await prisma.project.findUnique({ where: { ownerId_name: { ownerId, name: project.name } }, select: { id: true } })
  const saved = existing
    ? await prisma.project.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.project.create({ data: { ownerId, name: project.name, ...data }, select: { id: true } })

  for (const value of project.aliases) await prisma.projectAlias.upsert({ where: { projectId_value: { projectId: saved.id, value } }, create: { projectId: saved.id, value }, update: {} })
  for (const name of project.modules) await prisma.projectModule.upsert({ where: { projectId_name: { projectId: saved.id, name } }, create: { projectId: saved.id, name }, update: {} })

  // O id da etiqueta é do banco: os ids da base demo só servem para casar os vínculos.
  const tagIds = new Map<string, string>()
  for (const tag of project.tags) {
    const savedTag = await prisma.projectTag.upsert({
      where: { projectId_name: { projectId: saved.id, name: tag.name } },
      create: { projectId: saved.id, name: tag.name, color: tag.color },
      update: { color: tag.color },
      select: { id: true },
    })
    tagIds.set(tag.id, savedTag.id)
  }
  return { id: saved.id, created: !existing, tagIds }
}

async function seedTask(prisma: DemoSeedClient, projectId: string, task: Task) {
  const name = moduleName(task)
  const module = name ? await prisma.projectModule.upsert({ where: { projectId_name: { projectId, name } }, create: { projectId, name }, update: {}, select: { id: true } }) : null
  const data = { description: task.description ?? '', moduleId: module?.id ?? null, kind: toDbKind(task.kind ?? 'Tarefa') as any, status: toDbStatus(task.status) as any, priority: task.priority, complexity: toDbComplexity(task.complexity), dueAt: toDbDue(task.due), forecastAt: toDbDue(task.forecast) }
  const existing = await prisma.task.findFirst({ where: { projectId, title: task.title }, select: { id: true } })
  const saved = existing
    ? await prisma.task.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.task.create({ data: { projectId, title: task.title, ...data }, select: { id: true } })
  return { id: saved.id, created: !existing }
}

async function seedNote(prisma: DemoSeedClient, ownerId: string, projectId: string, taskId: string | null, note: Note) {
  const data = { taskId, title: note.title, content: note.content, pinned: note.pinned, position: note.position }
  const existing = await prisma.note.findFirst({ where: { ownerId, projectId, title: note.title }, select: { id: true } })
  const saved = existing
    ? await prisma.note.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.note.create({ data: { ownerId, projectId, ...data }, select: { id: true } })
  return { id: saved.id, created: !existing }
}

async function seedContext(prisma: DemoSeedClient, projectId: string, taskId: string | null, context: ProjectContextEntry) {
  const data = { taskId, content: context.content }
  const existing = await prisma.projectContext.findFirst({ where: { projectId, title: context.title }, select: { id: true } })
  const saved = existing
    ? await prisma.projectContext.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.projectContext.create({ data: { projectId, title: context.title, ...data }, select: { id: true } })
  return { id: saved.id, created: !existing }
}

async function seedMilestone(prisma: DemoSeedClient, projectId: string, milestone: Milestone) {
  const data = { description: milestone.description, startAt: toDbDate(milestone.startDate), targetAt: toDbDate(milestone.targetDate)!, status: toDbMilestoneStatus(milestone.status) as any }
  const existing = await prisma.milestone.findFirst({ where: { projectId, name: milestone.name }, select: { id: true } })
  const saved = existing
    ? await prisma.milestone.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.milestone.create({ data: { projectId, name: milestone.name, ...data }, select: { id: true } })
  return { id: saved.id, created: !existing }
}

async function seedInboxItem(prisma: DemoSeedClient, ownerId: string, item: InboxItem) {
  const data = { source: inboxSourceToDb[item.source], status: inboxStatusToDb[item.status], text: item.text, suggestion: item.suggestion }
  const existing = await prisma.inboxItem.findFirst({ where: { ownerId, source: data.source, text: item.text }, select: { id: true } })
  const saved = existing
    ? await prisma.inboxItem.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.inboxItem.create({ data: { ownerId, ...data }, select: { id: true } })
  return { id: saved.id, created: !existing }
}

/** Grava toda base demo persistível sem apagar nem duplicar registros existentes. */
export async function seedDemo(prisma: DemoSeedClient, ownerId: string) {
  const projectIds = new Map<string, string>()
  const projectIdBySeedId = new Map<string, string>()
  const tagIds = new Map<string, string>()
  let projectsCreated = 0
  let tagsCreated = 0
  for (const project of initialState.projects) {
    const saved = await seedProject(prisma, ownerId, project)
    projectIds.set(project.name, saved.id)
    projectIdBySeedId.set(project.id, saved.id)
    saved.tagIds.forEach((id, seedId) => tagIds.set(seedId, id))
    tagsCreated += saved.tagIds.size
    if (saved.created) projectsCreated += 1
  }

  const taskIds = new Map<string, string>()
  let tasksCreated = 0
  for (const task of initialState.tasks) {
    const projectId = projectIds.get(task.project)
    if (!projectId) throw new Error(`Card "${task.title}" aponta para projeto inexistente: ${task.project}`)
    const saved = await seedTask(prisma, projectId, task)
    taskIds.set(task.id, saved.id)
    if (saved.created) tasksCreated += 1
  }

  const milestoneIds = new Map<string, string>()
  let milestonesCreated = 0
  for (const milestone of initialState.milestones) {
    const projectId = projectIds.get(milestone.project)
    if (!projectId) throw new Error(`Marco "${milestone.name}" aponta para projeto inexistente: ${milestone.project}`)
    const saved = await seedMilestone(prisma, projectId, milestone)
    milestoneIds.set(milestone.id, saved.id)
    if (saved.created) milestonesCreated += 1
  }

  let dependencies = 0
  let milestoneLinks = 0
  let tagLinks = 0
  for (const task of initialState.tasks) {
    const taskId = taskIds.get(task.id)
    if (!taskId) continue
    for (const dependsOnId of task.dependsOnIds ?? []) {
      const blockingId = taskIds.get(dependsOnId)
      if (!blockingId) continue
      await prisma.taskDependency.upsert({ where: { taskId_dependsOnId: { taskId, dependsOnId: blockingId } }, create: { taskId, dependsOnId: blockingId }, update: {} })
      dependencies += 1
    }
    for (const milestoneId of task.milestoneIds ?? []) {
      const savedMilestoneId = milestoneIds.get(milestoneId)
      if (!savedMilestoneId) continue
      await prisma.taskMilestone.upsert({ where: { taskId_milestoneId: { taskId, milestoneId: savedMilestoneId } }, create: { taskId, milestoneId: savedMilestoneId }, update: {} })
      milestoneLinks += 1
    }
    for (const tagId of task.tagIds ?? []) {
      const savedTagId = tagIds.get(tagId)
      if (!savedTagId) continue
      await prisma.taskTag.upsert({ where: { taskId_tagId: { taskId, tagId: savedTagId } }, create: { taskId, tagId: savedTagId }, update: {} })
      tagLinks += 1
    }
  }

  let notesCreated = 0
  for (const note of initialState.notes) {
    const projectId = projectIdBySeedId.get(note.projectId)
    if (!projectId) throw new Error(`Nota "${note.title}" aponta para projeto inexistente: ${note.projectId}`)
    const saved = await seedNote(prisma, ownerId, projectId, taskIds.get(note.taskId ?? '') ?? null, note)
    if (saved.created) notesCreated += 1
  }

  let contextsCreated = 0
  for (const context of initialState.contexts) {
    const projectId = projectIdBySeedId.get(context.projectId)
    if (!projectId) throw new Error(`Contexto "${context.title}" aponta para projeto inexistente: ${context.projectId}`)
    const saved = await seedContext(prisma, projectId, taskIds.get(context.taskId ?? '') ?? null, context)
    if (saved.created) contextsCreated += 1
  }

  let inboxCreated = 0
  for (const item of initialState.inbox) {
    const saved = await seedInboxItem(prisma, ownerId, item)
    if (saved.created) inboxCreated += 1
  }

  return {
    projects: { total: initialState.projects.length, created: projectsCreated },
    tasks: { total: initialState.tasks.length, created: tasksCreated },
    milestones: { total: initialState.milestones.length, created: milestonesCreated },
    notes: { total: initialState.notes.length, created: notesCreated },
    contexts: { total: initialState.contexts.length, created: contextsCreated },
    inbox: { total: initialState.inbox.length, created: inboxCreated },
    dependencies,
    milestoneLinks,
    tags: tagsCreated,
    tagLinks,
  }
}
