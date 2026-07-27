export type TaskStatus = 'Backlog' | 'Em andamento' | 'Bloqueada' | 'Em validação' | 'Concluída' | 'Cancelada'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type MilestoneStatus = 'Planejado' | 'Em andamento' | 'Atingido' | 'Adiado' | 'Cancelado'
export type EntryKind = 'Tarefa' | 'Bug' | 'Melhoria' | 'Funcionalidade' | 'Decisão' | 'Solicitação externa' | 'Ideia futura' | 'Pergunta'
export type InboxStatus = 'Recebida' | 'Transcrevendo' | 'Analisando contexto' | 'Aguardando confirmação' | 'Processada' | 'Descartada' | 'Com erro'
export type InboxSource = 'Texto' | 'Áudio' | 'Trello' | 'MCP' | 'Planilha'

export type ContextSuggestion = {
  title: string
  summary: string
  project: string
  module: string
  kind: EntryKind
  priority: Priority
  confidence: number
  evidence: string[]
  duplicates: string[]
  action: string
  due?: string
  responsible?: string
}

export type Task = {
  id: string
  title: string
  project: string
  module?: string
  kind?: EntryKind
  status: TaskStatus
  priority: Priority
  time: string
  duration: string
  dependency?: string
  due?: string
  color: string
  sourceInboxId?: string
  sourceNoteId?: string
  milestoneIds?: string[]
}
export type Project = {
  id: string
  name: string
  description: string
  color: string
  progress: number
  priority: Priority
  aliases: string[]
  modules: string[]
  archived: boolean
}
export type Milestone = {
  id: string
  name: string
  project: string
  startDate?: string
  targetDate: string
  status: MilestoneStatus
  description: string
  color: string
}
export type Note = {
  id: string
  title: string
  content: string
  createdAt: string
  visibility: 'Privada'
  availableToAi: false
  availableToMcp: false
  pinned: boolean
  convertedTaskId?: string
}
export type InboxItem = {
  id: string
  text: string
  source: InboxSource
  status: InboxStatus
  date: string
  suggestion?: ContextSuggestion
}
export type AppState = { tasks: Task[]; projects: Project[]; milestones: Milestone[]; actionPlan: Task[]; inbox: InboxItem[]; notes: Note[]; activity: string[] }
export type TaskFilter = { project?: string; status?: TaskStatus; query?: string }
export type MilestoneFilter = '' | 'unassigned' | string

export const initialState: AppState = {
  projects: [
    { id: 'vistafor', name: 'VistaFor', description: 'PAX · Plataforma de atendimento e serviços', color: '#68d7a7', progress: 72, priority: 'P0', aliases: ['PAX'], modules: ['Loteamentos / Mapa', 'API'], archived: false },
    { id: 'observa', name: 'Observa SEUMA', description: 'Monitoramento e indicadores ambientais', color: '#64a3ff', progress: 48, priority: 'P1', aliases: [], modules: ['Mapa de processos'], archived: false },
    { id: 'intranet', name: 'Intranet', description: 'Portal institucional interno', color: '#aa8cff', progress: 35, priority: 'P1', aliases: [], modules: ['Acessos'], archived: false },
    { id: 'vistoria', name: 'App Vistoria', description: 'Fluxos CELAM/NUEE em campo', color: '#f0ad5b', progress: 61, priority: 'P2', aliases: [], modules: ['CELAM', 'NUEE'], archived: false },
  ],
  milestones: [
    { id: 'milestone-vistafor-mvp', name: 'MVP interno', project: 'VistaFor', startDate: '2026-07-20', targetDate: '2026-07-24', status: 'Em andamento', description: 'Fluxo principal validado internamente.', color: '#68d7a7' },
    { id: 'milestone-vistafor-homologacao', name: 'Homologação CEGEO', project: 'VistaFor', startDate: '2026-07-24', targetDate: '2026-07-27', status: 'Planejado', description: 'Regras e mapa aprovados pela equipe responsável.', color: '#68d7a7' },
    { id: 'milestone-observa-dashboard', name: 'Dashboard ambiental', project: 'Observa SEUMA', targetDate: '2026-07-25', status: 'Planejado', description: 'Indicadores principais disponíveis para conferência.', color: '#64a3ff' },
    { id: 'milestone-intranet-acessos', name: 'Acessos revisados', project: 'Intranet', targetDate: '2026-07-24', status: 'Em andamento', description: 'Perfis e permissões institucionais validados.', color: '#aa8cff' },
  ],
  tasks: [
    { id: 'task-1', title: 'Corrigir exclusão de medidas', project: 'VistaFor', module: 'Loteamentos / Mapa', kind: 'Bug', status: 'Backlog', priority: 'P0', time: '09:00', duration: '1h 30m', dependency: 'Validação da CEGEO', due: '24/07', color: '#68d7a7', milestoneIds: ['milestone-vistafor-mvp', 'milestone-vistafor-homologacao'] },
    { id: 'task-2', title: 'Reproduzir erro e registrar resposta da API', project: 'VistaFor', module: 'API', kind: 'Bug', status: 'Em andamento', priority: 'P1', time: '10:45', duration: '1h 30m', dependency: 'Depende de 1', due: '24/07', color: '#68d7a7', milestoneIds: ['milestone-vistafor-mvp'] },
    { id: 'task-3', title: 'Validar regra de permissões', project: 'Intranet', module: 'Acessos', kind: 'Tarefa', status: 'Backlog', priority: 'P1', time: '13:30', duration: '1h 30m', dependency: 'Depende de 1', due: '24/07', color: '#aa8cff', milestoneIds: ['milestone-intranet-acessos'] },
    { id: 'task-4', title: 'Revisar fluxo de onboarding', project: 'App Vistoria', status: 'Bloqueada', priority: 'P2', time: '15:15', duration: '45m', dependency: 'Aguardando acesso', due: '24/07', color: '#f0ad5b' },
    { id: 'task-5', title: 'Mapear campos do legado', project: 'Observa SEUMA', status: 'Backlog', priority: 'P2', time: '16:15', duration: '45m', due: '25/07', color: '#64a3ff', milestoneIds: ['milestone-observa-dashboard'] },
    { id: 'task-6', title: 'Revisar plano de testes', project: 'VistaFor', status: 'Concluída', priority: 'P2', time: '17:15', duration: '45m', due: '23/07', color: '#68d7a7' },
  ],
  actionPlan: [],
  inbox: [
    {
      id: 'inbox-1',
      text: 'A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.',
      source: 'Texto',
      status: 'Aguardando confirmação',
      date: 'há 18 min',
      suggestion: buildContextSuggestion('A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.'),
    },
    {
      id: 'inbox-2',
      text: 'Ideia: separar fila de validação por setor',
      source: 'Texto',
      status: 'Recebida',
      date: 'ontem',
    },
  ],
  notes: [],
  activity: ['Plano recalculado às 08:42', 'Tarefa "Revisar plano de testes" concluída ontem'],
}

initialState.actionPlan = initialState.tasks.filter((task) => task.status !== 'Concluída')

export function addProject(
  state: AppState,
  input: { name: string; description: string; color: string; priority: Priority },
): AppState {
  const name = input.name.trim()
  if (!name || state.projects.some((project) => project.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return state
  const project: Project = {
    id: `project-${Date.now()}`,
    name,
    description: input.description.trim(),
    color: input.color || '#68d7a7',
    progress: 0,
    priority: input.priority,
    aliases: [],
    modules: [],
    archived: false,
  }
  return {
    ...state,
    projects: [project, ...state.projects],
    activity: [`Projeto "${project.name}" criado agora`, ...state.activity],
  }
}

export function updateProject(
  state: AppState,
  projectId: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'priority'>>,
): AppState {
  const project = state.projects.find((item) => item.id === projectId)
  const name = patch.name?.trim()
  if (!project || (patch.name !== undefined && !name)) return state
  if (name && state.projects.some((item) => item.id !== projectId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return state
  const nextName = name ?? project.name
  const projects = state.projects.map((item) => item.id === projectId ? {
    ...item,
    ...patch,
    ...(name ? { name } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
  } : item)
  return {
    ...state,
    projects,
    tasks: state.tasks.map((task) => task.project === project.name ? { ...task, project: nextName, ...(patch.color ? { color: patch.color } : {}) } : task),
    actionPlan: state.actionPlan.map((task) => task.project === project.name ? { ...task, project: nextName, ...(patch.color ? { color: patch.color } : {}) } : task),
    milestones: state.milestones.map((milestone) => milestone.project === project.name ? { ...milestone, project: nextName, ...(patch.color ? { color: patch.color } : {}) } : milestone),
    activity: [`Projeto "${nextName}" atualizado agora`, ...state.activity],
  }
}

export function toggleProjectArchived(state: AppState, projectId: string): AppState {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return state
  const archived = !project.archived
  return {
    ...state,
    projects: state.projects.map((item) => item.id === projectId ? { ...item, archived } : item),
    activity: [`Projeto "${project.name}" ${archived ? 'arquivado' : 'reativado'} agora`, ...state.activity],
  }
}

function updateProjectList(
  state: AppState,
  projectId: string,
  field: 'aliases' | 'modules',
  value: string,
  operation: 'add' | 'remove',
): AppState {
  const project = state.projects.find((item) => item.id === projectId)
  const clean = value.trim()
  if (!project || !clean) return state
  const current = project[field]
  const index = current.findIndex((item) => item.toLocaleLowerCase() === clean.toLocaleLowerCase())
  if (operation === 'add' && index >= 0) return state
  if (operation === 'remove' && index < 0) return state
  const next = operation === 'add' ? [...current, clean] : current.filter((_, itemIndex) => itemIndex !== index)
  return { ...state, projects: state.projects.map((item) => item.id === projectId ? { ...item, [field]: next } : item) }
}

export function addProjectAlias(state: AppState, projectId: string, alias: string): AppState {
  return updateProjectList(state, projectId, 'aliases', alias, 'add')
}

export function removeProjectAlias(state: AppState, projectId: string, alias: string): AppState {
  return updateProjectList(state, projectId, 'aliases', alias, 'remove')
}

export function addProjectModule(state: AppState, projectId: string, module: string): AppState {
  return updateProjectList(state, projectId, 'modules', module, 'add')
}

export function removeProjectModule(state: AppState, projectId: string, module: string): AppState {
  return updateProjectList(state, projectId, 'modules', module, 'remove')
}

export function addTask(
  state: AppState,
  input: { title: string; project: string; module?: string; priority?: Priority; due?: string },
): AppState {
  const title = input.title.trim()
  const project = state.projects.find((item) => item.name === input.project)
  if (!title || !project || project.archived) return state
  const task: Task = {
    id: `task-${Date.now()}`,
    title,
    project: project.name,
    module: input.module?.trim() || 'Geral',
    kind: 'Tarefa',
    status: 'Backlog',
    priority: input.priority ?? 'P3',
    time: '—',
    duration: 'A estimar',
    due: input.due?.trim() || undefined,
    color: project.color,
  }
  return {
    ...state,
    tasks: [task, ...state.tasks],
    actionPlan: [task, ...state.actionPlan],
    activity: [`Tarefa "${task.title}" criada agora`, ...state.activity],
  }
}

export function updateTask(
  state: AppState,
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'project' | 'module' | 'kind' | 'priority' | 'due' | 'dependency' | 'duration'>>,
): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  const title = patch.title?.trim()
  const project = patch.project ? state.projects.find((item) => item.name === patch.project) : undefined
  if (!task || (patch.title !== undefined && !title) || (patch.project !== undefined && !project)) return state
  const nextTask = {
    ...task,
    ...patch,
    ...(title ? { title } : {}),
    ...(patch.module !== undefined ? { module: patch.module.trim() || 'Geral' } : {}),
    ...(patch.due !== undefined ? { due: patch.due.trim() || undefined } : {}),
    ...(patch.dependency !== undefined ? { dependency: patch.dependency.trim() || undefined } : {}),
    ...(project ? { project: project.name, color: project.color } : {}),
  }
  const replace = (item: Task) => item.id === taskId ? nextTask : item
  return {
    ...state,
    tasks: state.tasks.map(replace),
    actionPlan: state.actionPlan.map(replace),
    activity: [`Tarefa "${nextTask.title}" atualizada agora`, ...state.activity],
  }
}

export function completeTask(state: AppState, taskId: string): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task) return state
  return { ...state, tasks: state.tasks.map((item) => item.id === taskId ? { ...item, status: 'Concluída' } : item), actionPlan: state.actionPlan.filter((item) => item.id !== taskId), activity: [`Tarefa "${task.title}" concluída agora`, ...state.activity] }
}

export function addInboxItem(state: AppState, text: string): AppState {
  const clean = text.trim()
  if (!clean) return state
  return {
    ...state,
    inbox: [{
      id: `inbox-${Date.now()}`,
      text: clean,
      source: 'Texto',
      status: 'Recebida',
      date: 'agora',
    }, ...state.inbox],
  }
}

export function addNote(state: AppState, input: { title: string; content: string }): AppState {
  const content = input.content.trim()
  if (!content) return state
  const title = input.title.trim() || (content.length > 72 ? `${content.slice(0, 69)}...` : content)
  const note: Note = {
    id: `note-${Date.now()}`,
    title,
    content,
    createdAt: 'agora',
    visibility: 'Privada',
    availableToAi: false,
    availableToMcp: false,
    pinned: false,
  }
  return {
    ...state,
    notes: [note, ...state.notes],
    activity: [`Nota "${note.title}" criada agora`, ...state.activity],
  }
}

export function toggleNotePinned(state: AppState, noteId: string): AppState {
  if (!state.notes.some((note) => note.id === noteId)) return state
  return {
    ...state,
    notes: state.notes.map((note) => note.id === noteId ? { ...note, pinned: !note.pinned } : note),
  }
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return notes
  return notes.filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase().includes(normalized))
}

export function updateNote(state: AppState, noteId: string, input: { title: string; content: string }): AppState {
  const note = state.notes.find((item) => item.id === noteId)
  const content = input.content.trim()
  if (!note || !content) return state
  const title = input.title.trim() || (content.length > 72 ? `${content.slice(0, 69)}...` : content)
  return {
    ...state,
    notes: state.notes.map((item) => item.id === noteId ? { ...item, title, content } : item),
    activity: [`Nota "${title}" editada agora`, ...state.activity],
  }
}

export function convertNoteToTask(state: AppState, noteId: string, projectName: string): AppState {
  const note = state.notes.find((item) => item.id === noteId)
  const project = state.projects.find((item) => item.name === projectName)
  if (!note || !project || note.convertedTaskId) return state
  const task: Task = {
    id: `task-from-${note.id}`,
    title: note.title,
    project: project.name,
    module: 'Geral',
    kind: 'Tarefa',
    status: 'Backlog',
    priority: 'P3',
    time: '—',
    duration: 'A estimar',
    color: project.color,
    sourceNoteId: note.id,
  }
  return {
    ...state,
    tasks: [task, ...state.tasks],
    notes: state.notes.map((item) => item.id === note.id ? { ...item, convertedTaskId: task.id } : item),
    activity: [`Nota "${note.title}" convertida em tarefa`, ...state.activity],
  }
}

export function analyzeInboxItem(state: AppState, inboxId: string): AppState {
  const item = state.inbox.find((entry) => entry.id === inboxId)
  if (!item || item.status === 'Processada' || item.status === 'Descartada') return state
  return {
    ...state,
    inbox: state.inbox.map((entry) => entry.id === inboxId
      ? { ...entry, status: 'Aguardando confirmação', suggestion: buildContextSuggestion(entry.text) }
      : entry),
  }
}

export function updateInboxSuggestion(
  state: AppState,
  inboxId: string,
  patch: Partial<ContextSuggestion>,
): AppState {
  return {
    ...state,
    inbox: state.inbox.map((entry) => entry.id === inboxId && entry.suggestion
      ? { ...entry, suggestion: { ...entry.suggestion, ...patch } }
      : entry),
  }
}

export function confirmInboxItem(state: AppState, inboxId: string): AppState {
  const item = state.inbox.find((entry) => entry.id === inboxId)
  if (!item?.suggestion || item.status === 'Processada') return state
  if (state.tasks.some((task) => task.sourceInboxId === inboxId)) {
    return {
      ...state,
      inbox: state.inbox.map((entry) => entry.id === inboxId ? { ...entry, status: 'Processada' } : entry),
    }
  }
  const project = state.projects.find((entry) => entry.name === item.suggestion?.project)
  const task: Task = {
    id: `task-from-${inboxId}`,
    title: item.suggestion.title,
    project: item.suggestion.project,
    module: item.suggestion.module,
    kind: item.suggestion.kind,
    status: 'Backlog',
    priority: item.suggestion.priority,
    time: '—',
    duration: 'A estimar',
    due: item.suggestion.due,
    color: project?.color ?? '#79dfb2',
    sourceInboxId: inboxId,
  }
  return {
    ...state,
    tasks: [task, ...state.tasks],
    inbox: state.inbox.map((entry) => entry.id === inboxId ? { ...entry, status: 'Processada' } : entry),
    activity: [`Tarefa "${task.title}" criada pela revisão contextual`, ...state.activity],
  }
}

export function discardInboxItem(state: AppState, inboxId: string): AppState {
  return {
    ...state,
    inbox: state.inbox.map((entry) => entry.id === inboxId ? { ...entry, status: 'Descartada' } : entry),
  }
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const query = filter.query?.trim().toLocaleLowerCase()
  return tasks.filter((task) => {
    const matchesProject = !filter.project || task.project === filter.project
    const matchesStatus = !filter.status || task.status === filter.status
    const matchesQuery = !query || `${task.title} ${task.project} ${task.dependency ?? ''}`.toLocaleLowerCase().includes(query)
    return matchesProject && matchesStatus && matchesQuery
  })
}

export function filterTasksByMilestone(tasks: Task[], milestoneId: MilestoneFilter): Task[] {
  if (!milestoneId) return tasks
  if (milestoneId === 'unassigned') return tasks.filter((task) => !task.milestoneIds?.length)
  return tasks.filter((task) => task.milestoneIds?.includes(milestoneId))
}

export function getMilestoneProgress(milestone: Milestone, tasks: Task[]): {
  completed: number
  total: number
  percentage: number
} {
  const linked = tasks.filter((task) => task.milestoneIds?.includes(milestone.id))
  const completed = linked.filter((task) => task.status === 'Concluída').length
  return {
    completed,
    total: linked.length,
    percentage: linked.length ? Math.round((completed / linked.length) * 100) : 0,
  }
}

export function addMilestone(
  state: AppState,
  input: { name: string; project: string; startDate?: string; targetDate: string; description: string },
): AppState {
  const name = input.name.trim()
  const description = input.description.trim()
  const project = state.projects.find((item) => item.name === input.project)
  if (!name || !project || !input.targetDate) return state
  const milestone: Milestone = {
    id: `milestone-${Date.now()}`,
    name,
    project: project.name,
    startDate: input.startDate || undefined,
    targetDate: input.targetDate,
    status: 'Planejado',
    description,
    color: project.color,
  }
  return {
    ...state,
    milestones: [milestone, ...state.milestones],
    activity: [`Marco "${milestone.name}" criado agora`, ...state.activity],
  }
}

export function updateMilestone(
  state: AppState,
  milestoneId: string,
  patch: Partial<Pick<Milestone, 'name' | 'startDate' | 'targetDate' | 'status' | 'description'>>,
): AppState {
  const milestone = state.milestones.find((item) => item.id === milestoneId)
  if (!milestone) return state
  const name = patch.name?.trim()
  if (patch.name !== undefined && !name) return state
  if (patch.targetDate !== undefined && !patch.targetDate.trim()) return state
  return {
    ...state,
    milestones: state.milestones.map((item) => item.id === milestoneId ? {
      ...item,
      ...patch,
      ...(name ? { name } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate || undefined } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
    } : item),
    activity: [`Marco "${name ?? milestone.name}" atualizado agora`, ...state.activity],
  }
}

export function setTaskMilestones(state: AppState, taskId: string, milestoneIds: string[]): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task) return state
  const validIds = [...new Set(milestoneIds)].filter((milestoneId) =>
    state.milestones.some((milestone) => milestone.id === milestoneId && milestone.project === task.project))
  const updateTask = (item: Task): Task => item.id === taskId ? { ...item, milestoneIds: validIds } : item
  return {
    ...state,
    tasks: state.tasks.map(updateTask),
    actionPlan: state.actionPlan.map(updateTask),
    activity: [`Marcos da tarefa "${task.title}" atualizados`, ...state.activity],
  }
}

export function removeMilestone(state: AppState, milestoneId: string): AppState {
  const milestone = state.milestones.find((item) => item.id === milestoneId)
  if (!milestone) return state
  const removeReference = (task: Task): Task => ({
    ...task,
    milestoneIds: task.milestoneIds?.filter((id) => id !== milestoneId) ?? [],
  })
  return {
    ...state,
    milestones: state.milestones.filter((item) => item.id !== milestoneId),
    tasks: state.tasks.map(removeReference),
    actionPlan: state.actionPlan.map(removeReference),
    activity: [`Marco "${milestone.name}" removido agora`, ...state.activity],
  }
}

export function moveTask(state: AppState, taskId: string, status: TaskStatus): AppState {
  if (!state.tasks.some((task) => task.id === taskId)) return state
  const tasks = state.tasks.map((task) => task.id === taskId ? { ...task, status } : task)
  return { ...state, tasks, actionPlan: state.actionPlan.map((task) => task.id === taskId ? { ...task, status } : task) }
}

export function moveTaskTo(state: AppState, taskId: string, status: TaskStatus, beforeTaskId?: string): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task || taskId === beforeTaskId) return state
  const moved: Task = { ...task, status }
  const rest = state.tasks.filter((item) => item.id !== taskId)
  const index = beforeTaskId ? rest.findIndex((item) => item.id === beforeTaskId) : -1
  const tasks = index >= 0 ? [...rest.slice(0, index), moved, ...rest.slice(index)] : [...rest, moved]
  return {
    ...state,
    tasks,
    actionPlan: state.actionPlan.map((item) => item.id === taskId ? { ...item, status } : item),
    activity: [`Tarefa "${task.title}" movida para ${status}`, ...state.activity],
  }
}

function reorder<T extends { id: string }>(items: T[], draggedId: string, beforeId?: string): T[] | null {
  if (draggedId === beforeId) return null
  const dragged = items.find((item) => item.id === draggedId)
  if (!dragged) return null
  const rest = items.filter((item) => item.id !== draggedId)
  const index = beforeId ? rest.findIndex((item) => item.id === beforeId) : -1
  return index >= 0 ? [...rest.slice(0, index), dragged, ...rest.slice(index)] : [...rest, dragged]
}

export function reorderActionPlan(state: AppState, draggedId: string, beforeId?: string): AppState {
  const actionPlan = reorder(state.actionPlan, draggedId, beforeId)
  return actionPlan ? { ...state, actionPlan } : state
}

export function reorderNotes(state: AppState, draggedId: string, beforeId?: string): AppState {
  const notes = reorder(state.notes, draggedId, beforeId)
  return notes ? { ...state, notes } : state
}

export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    Backlog: [],
    'Em andamento': [],
    Bloqueada: [],
    'Em validação': [],
    Concluída: [],
    Cancelada: [],
  }
  tasks.forEach((task) => groups[task.status].push(task))
  return groups
}

function buildContextSuggestion(text: string): ContextSuggestion {
  const normalized = text.toLocaleLowerCase()
  const isVistaFor = ['planta', 'raster', 'loteamento', 'mapa'].some((term) => normalized.includes(term))
  const isIntranet = ['intranet', 'permissão', 'permissoes', 'acesso'].some((term) => normalized.includes(term))

  if (isVistaFor) {
    return {
      title: normalized.includes('planta')
        ? 'Corrigir carregamento automático da planta principal'
        : 'Revisar lentidão no carregamento do mapa',
      summary: 'Falha no carregamento inicial do mapa prejudica navegação e desempenho.',
      project: 'VistaFor',
      module: 'Loteamentos / Mapa',
      kind: normalized.includes('trav') ? 'Bug' : 'Melhoria',
      priority: normalized.includes('prioridade alta') ? 'P1' : 'P2',
      confidence: 93,
      evidence: [
        'Texto menciona planta ou mapa.',
        'Vocabulário coincide com módulo Loteamentos / Mapa.',
        'PAX está cadastrado como alias de VistaFor.',
      ],
      duplicates: ['Raster da planta principal sobrepõe lotes ao abrir o mapa'],
      action: 'Reproduzir carregamento inicial e revisar regra da planta padrão.',
    }
  }

  if (isIntranet) {
    return {
      title: 'Revisar regra de acesso da Intranet',
      summary: 'Entrada relacionada a permissões e acesso do portal interno.',
      project: 'Intranet',
      module: 'Acessos',
      kind: 'Tarefa',
      priority: 'P2',
      confidence: 88,
      evidence: ['Texto menciona acesso ou permissão.', 'Termos coincidem com módulo Acessos da Intranet.'],
      duplicates: ['Validar regra de permissões'],
      action: 'Comparar regra informada com perfis atuais.',
    }
  }

  return {
    title: text.length > 72 ? `${text.slice(0, 69)}...` : text,
    summary: 'Entrada precisa de confirmação para ser associada ao contexto correto.',
    project: 'Observa SEUMA',
    module: 'Geral',
    kind: 'Tarefa',
    priority: 'P3',
    confidence: 64,
    evidence: ['Não há projeto explícito no texto.', 'Classificação usa contexto recente como hipótese.'],
    duplicates: [],
    action: 'Confirmar projeto e detalhar próxima ação.',
  }
}
