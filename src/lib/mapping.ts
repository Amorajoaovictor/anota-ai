import {
  toDayMonth,
  withDerivedProgress,
  type AppState,
  type Complexity,
  type ContextSuggestion,
  type EntryKind,
  type InboxItem,
  type InboxSource,
  type InboxStatus,
  type Milestone,
  type MilestoneStatus,
  type Note,
  type Priority,
  type Project,
  type ProjectContextEntry,
  type Tag,
  type Task,
  type TaskStatus,
} from '../domain'

/**
 * Único ponto de tradução entre o formato do banco e os tipos de `domain.ts`.
 * Nenhuma tela conhece enum do Prisma nem `Date`. Ver `arquitetura-navegacao.md`.
 */

const statusByDb: Record<string, TaskStatus> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  IN_REVIEW: 'Em validação',
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada',
}

const kindByDb: Record<string, EntryKind> = {
  TASK: 'Tarefa',
  BUG: 'Bug',
  IMPROVEMENT: 'Melhoria',
  FEATURE: 'Funcionalidade',
  DECISION: 'Decisão',
  EXTERNAL_REQUEST: 'Solicitação externa',
  FUTURE_IDEA: 'Ideia futura',
  QUESTION: 'Pergunta',
}

const complexityByDb: Record<number, Complexity> = { 1: 'Baixa', 2: 'Média', 3: 'Alta' }

const milestoneStatusByDb: Record<string, MilestoneStatus> = {
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  ACHIEVED: 'Atingido',
  POSTPONED: 'Adiado',
  CANCELED: 'Cancelado',
}

const inboxStatusByDb: Record<string, InboxStatus> = {
  RECEIVED: 'Recebida',
  TRANSCRIBING: 'Transcrevendo',
  ANALYZING: 'Analisando contexto',
  AWAITING_CONFIRMATION: 'Aguardando confirmação',
  PROCESSED: 'Processada',
  DISCARDED: 'Descartada',
  ERROR: 'Com erro',
}

const inboxSourceByDb: Record<string, InboxSource> = {
  TEXT: 'Texto',
  AUDIO: 'Áudio',
  TRELLO: 'Trello',
  MCP: 'MCP',
  SPREADSHEET: 'Planilha',
}

const statusToDb = invert(statusByDb)
const kindToDb = invert(kindByDb)
const milestoneStatusToDb = invert(milestoneStatusByDb)
const inboxStatusToDb = invert(inboxStatusByDb)

export type DbTag = {
  id: string
  name: string
  color: string
}

export type DbProject = {
  id: string
  name: string
  description: string
  color: string
  priority: Priority
  status: string
  aliases: { value: string }[]
  modules: { name: string }[]
  tags: DbTag[]
}

export type DbTask = {
  id: string
  title: string
  description: string
  status: string
  kind: string
  priority: Priority
  complexity: number | null
  dueAt: string | Date | null
  forecastAt: string | Date | null
  sourceInboxId: string | null
  sourceNoteId: string | null
  project: { name: string; color: string }
  module: { name: string } | null
  dependsOn?: { dependsOnId: string }[]
  milestones?: { milestoneId: string }[]
  tags?: { tagId: string }[]
}

export type DbMilestone = {
  id: string
  name: string
  description: string
  status: string
  startAt: string | Date | null
  targetAt: string | Date
  project: { name: string; color: string }
}

export type DbNote = {
  id: string
  projectId: string
  taskId: string | null
  title: string
  content: string
  pinned: boolean
  position: number
  createdAt: string | Date
  convertedTask?: { id: string } | null
}

export type DbContext = {
  id: string
  projectId: string
  taskId: string | null
  title: string
  content: string
  createdAt: string | Date
}

export type DbInboxItem = {
  id: string
  source: string
  status: string
  text: string
  suggestion: unknown
  createdAt: string | Date
}

export function toDomainTag(tag: DbTag): Tag {
  return { id: tag.id, name: tag.name, color: tag.color }
}

export function toDomainProject(project: DbProject): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    progress: 0,
    priority: project.priority,
    aliases: project.aliases.map((alias) => alias.value),
    modules: project.modules.map((module) => module.name),
    tags: project.tags.map(toDomainTag),
    archived: project.status === 'ARCHIVED',
  }
}

export function toDomainTask(task: DbTask): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    project: task.project.name,
    module: task.module?.name ?? 'Geral',
    kind: kindByDb[task.kind] ?? 'Tarefa',
    status: statusByDb[task.status] ?? 'Backlog',
    priority: task.priority,
    complexity: task.complexity === null ? undefined : complexityByDb[task.complexity],
    dependsOnIds: task.dependsOn?.map((link) => link.dependsOnId) ?? [],
    due: formatDue(task.dueAt),
    forecast: formatDue(task.forecastAt),
    color: task.project.color,
    sourceInboxId: task.sourceInboxId ?? undefined,
    sourceNoteId: task.sourceNoteId ?? undefined,
    milestoneIds: task.milestones?.map((link) => link.milestoneId) ?? [],
    tagIds: task.tags?.map((link) => link.tagId) ?? [],
  }
}

export function toDomainMilestone(milestone: DbMilestone): Milestone {
  return {
    id: milestone.id,
    name: milestone.name,
    project: milestone.project.name,
    startDate: formatDateInput(milestone.startAt),
    targetDate: formatDateInput(milestone.targetAt) ?? '',
    status: milestoneStatusByDb[milestone.status] ?? 'Planejado',
    description: milestone.description,
    color: milestone.project.color,
  }
}

export function toDomainNote(note: DbNote): Note {
  return {
    id: note.id,
    projectId: note.projectId,
    taskId: note.taskId ?? undefined,
    title: note.title,
    content: note.content,
    createdAt: formatTimestamp(note.createdAt),
    visibility: 'Privada',
    availableToAi: false,
    availableToMcp: false,
    pinned: note.pinned,
    position: note.position,
    convertedTaskId: note.convertedTask?.id,
  }
}

export function toDomainContext(context: DbContext): ProjectContextEntry {
  return {
    id: context.id,
    projectId: context.projectId,
    taskId: context.taskId ?? undefined,
    title: context.title,
    content: context.content,
    createdAt: formatTimestamp(context.createdAt),
  }
}

export function toDomainInbox(item: DbInboxItem): InboxItem {
  return {
    id: item.id,
    text: item.text,
    source: inboxSourceByDb[item.source] ?? 'Texto',
    status: inboxStatusByDb[item.status] ?? 'Recebida',
    date: formatTimestamp(item.createdAt),
    // O servidor é quem escreve nesse formato (`ai.classify`), então não precisa validar de novo aqui.
    suggestion: (item.suggestion as ContextSuggestion | null) ?? undefined,
  }
}

/**
 * Estado inicial da UI. Marco entra somente para leitura: criar e editar marco é Fase 5.
 */
export function toAppState(
  projects: DbProject[],
  tasks: DbTask[],
  milestones: DbMilestone[] = [],
  notes: DbNote[] = [],
  contexts: DbContext[] = [],
  inbox: DbInboxItem[] = [],
): AppState {
  const domainTasks = tasks.map(toDomainTask)
  return withDerivedProgress({
    projects: projects.map(toDomainProject),
    tasks: domainTasks,
    actionPlan: domainTasks.filter((task) => task.status !== 'Concluída' && task.status !== 'Cancelada'),
    milestones: milestones.map(toDomainMilestone),
    // `reorderNotes` assume ordem do array igual à ordem das posições.
    notes: notes.map(toDomainNote).sort((left, right) => left.position - right.position),
    contexts: contexts.map(toDomainContext),
    inbox: inbox.map(toDomainInbox),
    activity: [],
  })
}

export function toDbInboxStatus(status: InboxStatus): string {
  return inboxStatusToDb[status] ?? 'RECEIVED'
}

export function toDbStatus(status: TaskStatus): string {
  return statusToDb[status] ?? 'BACKLOG'
}

export function toDbKind(kind: EntryKind): string {
  return kindToDb[kind] ?? 'TASK'
}

export function toDbComplexity(complexity: Complexity | undefined): number | null {
  if (!complexity) return null
  const found = Object.entries(complexityByDb).find(([, label]) => label === complexity)
  return found ? Number(found[0]) : null
}

/**
 * A UI trabalha com `DD/MM` (o roadmap grava a chave do dia nesse formato). O ano
 * vem do ano corrente na escrita — data completa só na agenda da Fase 5.
 */
export function toDbDue(due: string | undefined, today = new Date()): string | null {
  if (!due?.trim()) return null
  const [day, month] = due.trim().split('/').map(Number)
  if (!day || !month || month > 12 || day > 31) return null
  const date = new Date(Date.UTC(today.getFullYear(), month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatDue(value: string | Date | null | undefined): string | undefined {
  const date = toDate(value)
  return date ? toDayMonth(date) : undefined
}

export function toDbMilestoneStatus(status: MilestoneStatus): string {
  return milestoneStatusToDb[status] ?? 'PLANNED'
}

/**
 * Marco usa data completa: `<input type="date">` fala `YYYY-MM-DD`, ao contrário do
 * `DD/MM` de prazo e previsão, que ainda resolvem o ano pelo ano corrente.
 */
export function toDbDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null
  const date = new Date(`${value.trim()}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateInput(value: string | Date | null | undefined): string | undefined {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : undefined
}

/** Data de criação de nota e contexto: dia e hora bastam na lista. */
export function formatTimestamp(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date
    ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'module' | 'kind' | 'status' | 'priority' | 'due' | 'forecast' | 'complexity' | 'dependsOnIds' | 'milestoneIds' | 'tagIds'>>

/** `Geral` é o rótulo de "sem módulo" na tela; no banco vira vínculo nulo. */
export function toDbModule(module: string | undefined) {
  const name = module?.trim()
  return !name || name === 'Geral' ? '' : name
}

export function toTaskCreateBody(projectId: string, task: Task) {
  return {
    projectId,
    title: task.title,
    description: task.description ?? '',
    moduleName: toDbModule(task.module),
    kind: toDbKind(task.kind ?? 'Tarefa'),
    status: toDbStatus(task.status),
    priority: task.priority,
    dueAt: toDbDue(task.due),
    forecastAt: toDbDue(task.forecast),
    complexity: toDbComplexity(task.complexity),
    milestoneIds: task.milestoneIds ?? [],
    tagIds: task.tagIds ?? [],
    sourceNoteId: task.sourceNoteId ?? null,
  }
}

/** Só as chaves presentes viajam: `taskPatchSchema` é `.strict()`. */
export function toTaskPatchBody(patch: TaskPatch) {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title.trim()
  if (patch.description !== undefined) body.description = patch.description.trim()
  if (patch.module !== undefined) body.moduleName = toDbModule(patch.module)
  if (patch.kind !== undefined) body.kind = toDbKind(patch.kind)
  if (patch.status !== undefined) body.status = toDbStatus(patch.status)
  if (patch.priority !== undefined) body.priority = patch.priority
  if (patch.due !== undefined) body.dueAt = toDbDue(patch.due)
  if (patch.forecast !== undefined) body.forecastAt = toDbDue(patch.forecast)
  if (patch.complexity !== undefined) body.complexity = toDbComplexity(patch.complexity)
  if (patch.dependsOnIds !== undefined) body.dependsOnIds = patch.dependsOnIds
  if (patch.milestoneIds !== undefined) body.milestoneIds = patch.milestoneIds
  if (patch.tagIds !== undefined) body.tagIds = patch.tagIds
  return body
}

/** `tags` viaja por nome e cor: o id é do banco e não é escolhido pela tela. */
export function toProjectPatchBody(
  patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'priority' | 'aliases' | 'modules' | 'archived'>>
    & { tags?: { name: string; color?: string }[] },
) {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.description !== undefined) body.description = patch.description.trim()
  if (patch.color !== undefined) body.color = patch.color
  if (patch.priority !== undefined) body.priority = patch.priority
  if (patch.archived !== undefined) body.archived = patch.archived
  if (patch.aliases !== undefined) body.aliases = patch.aliases
  if (patch.modules !== undefined) body.modules = patch.modules
  if (patch.tags !== undefined) {
    body.tags = patch.tags.map((tag) => tag.color ? { name: tag.name, color: tag.color } : { name: tag.name })
  }
  return body
}

export function toNoteCreateBody(note: Note) {
  return {
    projectId: note.projectId,
    taskId: note.taskId ?? null,
    title: note.title,
    content: note.content,
    pinned: note.pinned,
    position: note.position,
  }
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'position'>> & { taskId?: string | null }

export function toNotePatchBody(patch: NotePatch) {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title.trim()
  if (patch.content !== undefined) body.content = patch.content.trim()
  if (patch.pinned !== undefined) body.pinned = patch.pinned
  if (patch.position !== undefined) body.position = patch.position
  if (patch.taskId !== undefined) body.taskId = patch.taskId
  return body
}

export function toContextCreateBody(context: ProjectContextEntry) {
  return {
    projectId: context.projectId,
    taskId: context.taskId ?? null,
    title: context.title,
    content: context.content,
  }
}

export type ContextPatch = Partial<Pick<ProjectContextEntry, 'title' | 'content'>> & { taskId?: string | null }

export function toContextPatchBody(patch: ContextPatch) {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title.trim()
  if (patch.content !== undefined) body.content = patch.content.trim()
  if (patch.taskId !== undefined) body.taskId = patch.taskId
  return body
}

function invert<Value extends string>(map: Record<string, Value>): Record<Value, string> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])) as Record<Value, string>
}
