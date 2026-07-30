export type TaskStatus = 'Backlog' | 'Em andamento' | 'Bloqueada' | 'Em validação' | 'Concluída' | 'Cancelada'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type MilestoneStatus = 'Planejado' | 'Em andamento' | 'Atingido' | 'Adiado' | 'Cancelado'
export type EntryKind = 'Tarefa' | 'Bug' | 'Melhoria' | 'Funcionalidade' | 'Decisão' | 'Solicitação externa' | 'Ideia futura' | 'Pergunta'
export type InboxStatus = 'Recebida' | 'Transcrevendo' | 'Analisando contexto' | 'Aguardando confirmação' | 'Processada' | 'Descartada' | 'Com erro'
export type InboxSource = 'Texto' | 'Áudio' | 'Trello' | 'MCP' | 'Planilha'

/** Fase 0 do PRD: complexidade alimenta a previsão e nasce vazia até análise. */
export type Complexity = 'Baixa' | 'Média' | 'Alta'

export type ContextSuggestion = {
  title: string
  summary: string
  project: string
  module: string
  kind: EntryKind
  priority: Priority
  complexity: Complexity
  confidence: number
  evidence: string[]
  duplicates: string[]
  action: string
  due?: string
  forecast?: string
  responsible?: string
  /** Tags que ainda não existem no projeto e podem ser criadas junto da confirmação. */
  newTags?: string[]
}

/** Etiqueta do card. Pertence a um projeto: o vocabulário de um não vale no outro. */
export type Tag = {
  id: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  description?: string
  project: string
  module?: string
  kind?: EntryKind
  status: TaskStatus
  priority: Priority
  complexity?: Complexity
  /** Cards do mesmo projeto que precisam sair antes deste. Grava em `TaskDependency`. */
  dependsOnIds?: string[]
  due?: string
  /**
   * Previsão de entrega, distinta do prazo confirmado (`due`) por decisão da Fase 0.
   * Mesmo formato `DD/MM`. Previsão vencida é alerta, não atraso.
   */
  forecast?: string
  color: string
  sourceInboxId?: string
  sourceNoteId?: string
  milestoneIds?: string[]
  tagIds?: string[]
}
export type Project = {
  id: string
  name: string
  description: string
  color: string
  /** Derivado de `withDerivedProgress`, nunca gravado — PRD 10.1 diz "Calculado". */
  progress: number
  priority: Priority
  aliases: string[]
  modules: string[]
  tags: Tag[]
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
  projectId: string
  /** Card do mesmo projeto ao qual a nota se refere. Não é o card nascido dela. */
  taskId?: string
  title: string
  content: string
  createdAt: string
  visibility: 'Privada'
  availableToAi: false
  availableToMcp: false
  pinned: boolean
  /** Ordem do arraste. Gravada para o refresh não desfazer o que o usuário organizou. */
  position: number
  convertedTaskId?: string
}

/**
 * Informação de projeto disponível para IA e MCP, ao contrário da nota privada
 * (Fase 0). Pode apontar para um card do mesmo projeto.
 */
export type ProjectContextEntry = {
  id: string
  projectId: string
  taskId?: string
  title: string
  content: string
  createdAt: string
}
export type InboxItem = {
  id: string
  text: string
  source: InboxSource
  status: InboxStatus
  date: string
  suggestion?: ContextSuggestion
}
/**
 * Status em que o item ainda depende de um job rodar (`ai.classify`/`audio.transcribe`).
 * Só esses valem a pena reconsultar por polling — a partir de "Aguardando confirmação"
 * nada muda sozinho no servidor, só por ação do usuário.
 */
export const pendingInboxStatuses: InboxStatus[] = ['Recebida', 'Transcrevendo', 'Analisando contexto']

export const taskStatuses: TaskStatus[] = ['Backlog', 'Em andamento', 'Bloqueada', 'Em validação', 'Concluída', 'Cancelada']
export const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3']
export const entryKinds: EntryKind[] = ['Tarefa', 'Bug', 'Melhoria', 'Funcionalidade', 'Decisão', 'Solicitação externa', 'Ideia futura', 'Pergunta']
export const complexities: Complexity[] = ['Baixa', 'Média', 'Alta']

export type AppState = { tasks: Task[]; projects: Project[]; milestones: Milestone[]; actionPlan: Task[]; inbox: InboxItem[]; notes: Note[]; contexts: ProjectContextEntry[]; activity: string[] }
export type TaskFilter = { project?: string; status?: TaskStatus; query?: string }
export type MilestoneFilter = '' | 'unassigned' | string

/**
 * Escopo de uma visão. Planilha, Kanban, Marcos, Roadmap, Prazos e Notas são a
 * mesma tela renderizada com escopo global ou travada em um projeto.
 * Ver `arquitetura-navegacao.md`.
 */
export type Scope = { type: 'global' } | { type: 'project'; projectId: string }

/**
 * Base de demonstração da Fase 1. Fora dos testes, o estado real vem do banco
 * por `src/lib/mapping.ts` — ver `arquitetura-navegacao.md`.
 */
const seedState: AppState = {
  projects: [
    { id: 'vistafor', name: 'VistaFor', description: 'PAX · Plataforma de atendimento e serviços', color: '#68d7a7', progress: 0, priority: 'P0', aliases: ['PAX'], modules: ['Loteamentos / Mapa', 'API'], tags: [{ id: 'tag-vistafor-raster', name: 'raster', color: '#68d7a7' }, { id: 'tag-vistafor-cegeo', name: 'CEGEO', color: '#f0ad5b' }], archived: false },
    { id: 'observa', name: 'Observa SEUMA', description: 'Monitoramento e indicadores ambientais', color: '#64a3ff', progress: 0, priority: 'P1', aliases: [], modules: ['Mapa de processos'], tags: [{ id: 'tag-observa-legado', name: 'legado', color: '#64a3ff' }], archived: false },
    { id: 'intranet', name: 'Intranet', description: 'Portal institucional interno', color: '#aa8cff', progress: 0, priority: 'P1', aliases: [], modules: ['Acessos'], tags: [{ id: 'tag-intranet-seguranca', name: 'segurança', color: '#aa8cff' }], archived: false },
    { id: 'vistoria', name: 'App Vistoria', description: 'Fluxos CELAM/NUEE em campo', color: '#f0ad5b', progress: 0, priority: 'P2', aliases: [], modules: ['CELAM', 'NUEE'], tags: [], archived: false },
  ],
  milestones: [
    { id: 'milestone-vistafor-mvp', name: 'MVP interno', project: 'VistaFor', startDate: '2026-07-20', targetDate: '2026-07-24', status: 'Em andamento', description: 'Fluxo principal validado internamente.', color: '#68d7a7' },
    { id: 'milestone-vistafor-homologacao', name: 'Homologação CEGEO', project: 'VistaFor', startDate: '2026-07-24', targetDate: '2026-07-27', status: 'Planejado', description: 'Regras e mapa aprovados pela equipe responsável.', color: '#68d7a7' },
    { id: 'milestone-observa-dashboard', name: 'Dashboard ambiental', project: 'Observa SEUMA', targetDate: '2026-07-25', status: 'Planejado', description: 'Indicadores principais disponíveis para conferência.', color: '#64a3ff' },
    { id: 'milestone-intranet-acessos', name: 'Acessos revisados', project: 'Intranet', targetDate: '2026-07-24', status: 'Em andamento', description: 'Perfis e permissões institucionais validados.', color: '#aa8cff' },
  ],
  tasks: [
    { id: 'task-1', title: 'Corrigir exclusão de medidas', description: 'Excluir uma medida no mapa não remove o registro correspondente na API.', project: 'VistaFor', module: 'Loteamentos / Mapa', kind: 'Bug', status: 'Backlog', priority: 'P0', complexity: 'Alta', due: '24/07', forecast: '29/07', color: '#68d7a7', milestoneIds: ['milestone-vistafor-mvp', 'milestone-vistafor-homologacao'], tagIds: ['tag-vistafor-cegeo'] },
    { id: 'task-2', title: 'Reproduzir erro e registrar resposta da API', project: 'VistaFor', module: 'API', kind: 'Bug', status: 'Em andamento', priority: 'P1', complexity: 'Média', dependsOnIds: ['task-1'], due: '24/07', color: '#68d7a7', milestoneIds: ['milestone-vistafor-mvp'], tagIds: ['tag-vistafor-raster'] },
    { id: 'task-3', title: 'Validar regra de permissões', project: 'Intranet', module: 'Acessos', kind: 'Tarefa', status: 'Backlog', priority: 'P1', complexity: 'Média', due: '24/07', color: '#aa8cff', milestoneIds: ['milestone-intranet-acessos'], tagIds: ['tag-intranet-seguranca'] },
    { id: 'task-4', title: 'Revisar fluxo de onboarding', project: 'App Vistoria', status: 'Bloqueada', priority: 'P2', complexity: 'Baixa', due: '24/07', color: '#f0ad5b' },
    { id: 'task-5', title: 'Mapear campos do legado', project: 'Observa SEUMA', status: 'Backlog', priority: 'P2', complexity: 'Baixa', due: '25/07', color: '#64a3ff', milestoneIds: ['milestone-observa-dashboard'], tagIds: ['tag-observa-legado'] },
    { id: 'task-6', title: 'Revisar plano de testes', project: 'VistaFor', status: 'Concluída', priority: 'P2', complexity: 'Baixa', due: '23/07', color: '#68d7a7' },
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
  notes: [
    { id: 'note-1', projectId: 'vistafor', taskId: 'task-1', title: 'Conferir com a CEGEO antes de mexer em medidas', content: 'A equipe pediu para validar qualquer mudança em medidas antes de publicar.', createdAt: 'ontem', visibility: 'Privada', availableToAi: false, availableToMcp: false, pinned: true, position: 0 },
    { id: 'note-2', projectId: 'observa', title: 'Ideia solta sobre indicadores', content: 'Talvez valha separar os indicadores por setor na tela inicial.', createdAt: 'há 2 dias', visibility: 'Privada', availableToAi: false, availableToMcp: false, pinned: false, position: 1 },
  ],
  contexts: [
    { id: 'context-1', projectId: 'vistafor', title: 'Toda demanda de medidas passa pela CEGEO', content: 'Regra combinada com a equipe: medidas georreferenciadas só entram em produção após validação da CEGEO.', createdAt: 'há 3 dias' },
    { id: 'context-2', projectId: 'vistafor', taskId: 'task-2', title: 'Planta principal carrega por padrão desde a migração', content: 'O carregamento automático veio da migração do PAX e é a origem provável dos travamentos do mapa.', createdAt: 'há 3 dias' },
  ],
  activity: ['Plano recalculado às 08:42', 'Tarefa "Revisar plano de testes" concluída ontem'],
}

seedState.actionPlan = seedState.tasks.filter((task) => task.status !== 'Concluída')

/**
 * Progresso do projeto é a proporção de cards concluídos. Fica derivado para não
 * existir um número gravado que possa divergir dos cards.
 */
export function withDerivedProgress(state: AppState): AppState {
  return {
    ...state,
    projects: state.projects.map((project) => {
      const tasks = state.tasks.filter((task) => task.project === project.name)
      const done = tasks.filter((task) => task.status === 'Concluída').length
      const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
      return progress === project.progress ? project : { ...project, progress }
    }),
  }
}

export const initialState: AppState = withDerivedProgress(seedState)

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
    tags: [],
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

/** Nome de alias, módulo ou tag: repetição só de caixa é a mesma coisa. */
function sameName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
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
  const index = current.findIndex((item) => sameName(item, clean))
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

/**
 * A tela edita as tags do projeto como lista, então a semântica é de conjunto: o
 * que não vier sai. Tag que continua na lista preserva o id, senão os cards
 * perderiam o vínculo a cada gravação. Tag que sai é retirada dos cards junto.
 */
export function setProjectTags(
  state: AppState,
  projectId: string,
  tags: { name: string; color?: string }[],
): AppState {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return state

  const next: Tag[] = []
  tags.forEach((tag) => {
    const name = tag.name.trim()
    if (!name || next.some((item) => sameName(item.name, name))) return
    const existing = project.tags.find((item) => sameName(item.name, name))
    next.push({
      id: existing?.id ?? `tag-${Date.now()}-${next.length}`,
      name,
      color: tag.color ?? existing?.color ?? project.color,
    })
  })

  const dropped = new Set(project.tags.filter((tag) => !next.some((item) => item.id === tag.id)).map((tag) => tag.id))
  const withoutDropped = (task: Task): Task => !dropped.size || !task.tagIds?.some((id) => dropped.has(id))
    ? task
    : { ...task, tagIds: task.tagIds.filter((id) => !dropped.has(id)) }

  return {
    ...state,
    projects: state.projects.map((item) => item.id === projectId ? { ...item, tags: next } : item),
    tasks: state.tasks.map(withoutDropped),
    actionPlan: state.actionPlan.map(withoutDropped),
  }
}

/** Tag de outro projeto é descartada sem derrubar a operação — igual a `setTaskMilestones`. */
export function setTaskTags(state: AppState, taskId: string, tagIds: string[]): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task) return state
  const valid = validTagIds(state, task.project, tagIds)
  const update = (item: Task): Task => item.id === taskId ? { ...item, tagIds: valid } : item
  return {
    ...state,
    tasks: state.tasks.map(update),
    actionPlan: state.actionPlan.map(update),
    activity: [`Etiquetas da tarefa "${task.title}" atualizadas`, ...state.activity],
  }
}

function validTagIds(state: AppState, projectName: string, tagIds: string[]): string[] {
  const owned = state.projects.find((item) => item.name === projectName)?.tags ?? []
  return [...new Set(tagIds)].filter((id) => owned.some((tag) => tag.id === id))
}

export function projectTags(state: AppState, projectName: string): Tag[] {
  return state.projects.find((item) => item.name === projectName)?.tags ?? []
}

/** Tags de um card, na ordem cadastrada no projeto. */
export function taskTags(state: AppState, task: Task): Tag[] {
  return projectTags(state, task.project).filter((tag) => task.tagIds?.includes(tag.id))
}

/**
 * Só título e projeto são obrigatórios. O resto vem do contexto da tela que
 * abriu a criação (coluna do Kanban, dia do roadmap, marco filtrado) ou de
 * `suggestTaskFields`. Ver `prd.md` seção 12.10.
 */
export function addTask(
  state: AppState,
  input: {
    title: string
    description?: string
    project: string
    module?: string
    kind?: EntryKind
    status?: TaskStatus
    priority?: Priority
    due?: string
    forecast?: string
    milestoneIds?: string[]
    tagIds?: string[]
  },
): AppState {
  const title = input.title.trim()
  const project = state.projects.find((item) => item.name === input.project)
  if (!title || !project || project.archived) return state
  const status = input.status ?? 'Backlog'
  // IDs inválidos são descartados sem impedir a criação — mesma regra de `setTaskMilestones`.
  const milestoneIds = [...new Set(input.milestoneIds ?? [])].filter((milestoneId) =>
    state.milestones.some((milestone) => milestone.id === milestoneId && milestone.project === project.name))
  const task: Task = {
    id: `task-${Date.now()}`,
    title,
    description: input.description?.trim() || undefined,
    project: project.name,
    module: input.module?.trim() || 'Geral',
    kind: input.kind ?? 'Tarefa',
    status,
    priority: input.priority ?? 'P3',
    due: input.due?.trim() || undefined,
    forecast: input.forecast?.trim() || undefined,
    color: project.color,
    milestoneIds,
    tagIds: validTagIds(state, project.name, input.tagIds ?? []),
  }
  // Card que nasce fechado não entra no plano do dia — `completeTask` faz o mesmo recorte.
  const inPlan = status !== 'Concluída' && status !== 'Cancelada'
  return {
    ...state,
    tasks: [task, ...state.tasks],
    actionPlan: inPlan ? [task, ...state.actionPlan] : state.actionPlan,
    activity: [`Tarefa "${task.title}" criada agora`, ...state.activity],
  }
}

/**
 * Autopreenchimento dos campos opcionais da criação manual. Reaproveita o mesmo
 * classificador da Caixa de entrada, mas o projeto escolhido pelo usuário é
 * soberano: se a hipótese apontar para outro projeto, o módulo sugerido é
 * descartado e trocado por um módulo real do projeto escolhido.
 */
export function suggestTaskFields(
  state: AppState,
  input: { title: string; project: string },
  today = new Date(),
): { module: string; kind: EntryKind; priority: Priority; complexity: Complexity; forecast: string; confidence: number; evidence: string[] } | null {
  const title = input.title.trim()
  const project = state.projects.find((item) => item.name === input.project)
  if (!title || !project) return null
  const suggestion = buildContextSuggestion(title)
  const normalized = title.toLocaleLowerCase()
  const sameProject = suggestion.project === project.name
  const module = sameProject
    ? suggestion.module
    : project.modules.find((item) => normalized.includes(item.toLocaleLowerCase())) ?? 'Geral'
  const complexity = suggestComplexity(suggestion.kind, suggestion.priority)
  return {
    module,
    kind: suggestion.kind,
    priority: suggestion.priority,
    complexity,
    forecast: suggestForecast(complexity, today),
    confidence: sameProject ? suggestion.confidence : Math.min(suggestion.confidence, 60),
    evidence: suggestion.evidence,
  }
}

/** Dias de folga por complexidade. Fase 0: "complexidade alimenta a previsão". */
const forecastDays: Record<Complexity, number> = { Baixa: 2, 'Média': 5, Alta: 10 }

/**
 * Previsão de entrega derivada da complexidade. É palpite de apoio, nunca prazo:
 * `due` continua sendo o único compromisso, e só o usuário o define.
 */
export function suggestForecast(complexity: Complexity, from = new Date()): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  date.setUTCDate(date.getUTCDate() + forecastDays[complexity])
  return toDayMonth(date)
}

/** Formato `DD/MM` usado por prazo e previsão na tela. */
export function toDayMonth(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Bug urgente é raramente barato; ideia futura raramente é caro. Heurística, não verdade. */
export function suggestComplexity(kind: EntryKind, priority: Priority): Complexity {
  if (kind === 'Funcionalidade' || priority === 'P0') return 'Alta'
  if (kind === 'Ideia futura' || kind === 'Pergunta' || priority === 'P3') return 'Baixa'
  return 'Média'
}

export function updateTask(
  state: AppState,
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'project' | 'module' | 'kind' | 'priority' | 'due' | 'forecast' | 'complexity' | 'dependsOnIds' | 'tagIds'>>,
): AppState {
  const task = state.tasks.find((item) => item.id === taskId)
  const title = patch.title?.trim()
  const project = patch.project ? state.projects.find((item) => item.name === patch.project) : undefined
  if (!task || (patch.title !== undefined && !title) || (patch.project !== undefined && !project)) return state
  const nextProject = project?.name ?? task.project
  const nextTask = {
    ...task,
    ...patch,
    ...(title ? { title } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() || undefined } : {}),
    ...(patch.module !== undefined ? { module: patch.module.trim() || 'Geral' } : {}),
    ...(patch.due !== undefined ? { due: patch.due.trim() || undefined } : {}),
    ...(patch.forecast !== undefined ? { forecast: patch.forecast.trim() || undefined } : {}),
    // Dependência só vale entre cards do mesmo projeto; trocar o projeto invalida o vínculo.
    ...(patch.dependsOnIds !== undefined || project
      ? { dependsOnIds: validDependencies(state, taskId, nextProject, patch.dependsOnIds ?? task.dependsOnIds ?? []) }
      : {}),
    // Tag e marco também pertencem ao projeto: trocar o projeto zera os dois.
    ...(patch.tagIds !== undefined || project
      ? { tagIds: validTagIds(state, nextProject, patch.tagIds ?? task.tagIds ?? []) }
      : {}),
    ...(project && project.name !== task.project ? { milestoneIds: [] } : {}),
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

/** Descarta autorreferência e alvos fora do projeto — o servidor aplica a mesma regra. */
function validDependencies(state: AppState, taskId: string, project: string, ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => id !== taskId
    && state.tasks.some((item) => item.id === id && item.project === project))
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

export function addNote(state: AppState, input: { title: string; content: string; projectId: string; taskId?: string }): AppState {
  const content = input.content.trim()
  const project = state.projects.find((item) => item.id === input.projectId)
  if (!content || !project) return state
  const title = input.title.trim() || (content.length > 72 ? `${content.slice(0, 69)}...` : content)
  const note: Note = {
    id: `note-${Date.now()}`,
    projectId: project.id,
    taskId: validNoteTaskId(state, project.name, input.taskId),
    title,
    content,
    createdAt: 'agora',
    visibility: 'Privada',
    availableToAi: false,
    availableToMcp: false,
    pinned: false,
    // Nota nova entra na frente: é o que o usuário acabou de escrever.
    position: Math.min(0, ...state.notes.map((item) => item.position)) - 1,
  }
  return {
    ...state,
    notes: [note, ...state.notes],
    activity: [`Nota "${note.title}" criada agora`, ...state.activity],
  }
}

/** Card de outro projeto é vínculo inválido: some sem impedir a gravação. */
function validNoteTaskId(state: AppState, projectName: string, taskId: string | undefined): string | undefined {
  if (!taskId) return undefined
  return state.tasks.some((task) => task.id === taskId && task.project === projectName) ? taskId : undefined
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

/** `taskId` é chave obrigatória — omiti-la apagaria o vínculo em silêncio. */
export function updateNote(state: AppState, noteId: string, input: { title: string; content: string; taskId: string | undefined }): AppState {
  const note = state.notes.find((item) => item.id === noteId)
  const content = input.content.trim()
  if (!note || !content) return state
  const project = state.projects.find((item) => item.id === note.projectId)
  const title = input.title.trim() || (content.length > 72 ? `${content.slice(0, 69)}...` : content)
  return {
    ...state,
    notes: state.notes.map((item) => item.id === noteId ? {
      ...item,
      title,
      content,
      taskId: validNoteTaskId(state, project?.name ?? '', input.taskId),
    } : item),
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

/**
 * Contexto é o oposto da nota: exige projeto e fica disponível para IA e MCP
 * (Fase 0). Título e conteúdo são obrigatórios; o card é vínculo opcional.
 */
export function addContext(
  state: AppState,
  input: { projectId: string; title: string; content: string; taskId?: string },
): AppState {
  const title = input.title.trim()
  const content = input.content.trim()
  const project = state.projects.find((item) => item.id === input.projectId)
  if (!title || !content || !project) return state
  const context: ProjectContextEntry = {
    id: `context-${Date.now()}`,
    projectId: project.id,
    taskId: validNoteTaskId(state, project.name, input.taskId),
    title,
    content,
    createdAt: 'agora',
  }
  return {
    ...state,
    contexts: [context, ...state.contexts],
    activity: [`Contexto "${context.title}" registrado agora`, ...state.activity],
  }
}

export function updateContext(
  state: AppState,
  contextId: string,
  input: { title: string; content: string; taskId: string | undefined },
): AppState {
  const context = state.contexts.find((item) => item.id === contextId)
  const title = input.title.trim()
  const content = input.content.trim()
  if (!context || !title || !content) return state
  const project = state.projects.find((item) => item.id === context.projectId)
  return {
    ...state,
    contexts: state.contexts.map((item) => item.id === contextId ? {
      ...item,
      title,
      content,
      taskId: validNoteTaskId(state, project?.name ?? '', input.taskId),
    } : item),
    activity: [`Contexto "${title}" atualizado agora`, ...state.activity],
  }
}

export function removeContext(state: AppState, contextId: string): AppState {
  const context = state.contexts.find((item) => item.id === contextId)
  if (!context) return state
  return {
    ...state,
    contexts: state.contexts.filter((item) => item.id !== contextId),
    activity: [`Contexto "${context.title}" removido agora`, ...state.activity],
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

export const globalScope: Scope = { type: 'global' }

export function projectScope(projectId: string): Scope {
  return { type: 'project', projectId }
}

export function scopeProject(state: AppState, scope: Scope): Project | undefined {
  return scope.type === 'project' ? state.projects.find((project) => project.id === scope.projectId) : undefined
}

/**
 * Projetos que alimentam a visão: todos os ativos no escopo global, apenas o
 * escolhido no escopo de projeto. Projeto arquivado sai das visões globais mas
 * continua acessível quando o usuário navega direto para ele.
 */
export function scopeProjects(state: AppState, scope: Scope): Project[] {
  if (scope.type === 'project') {
    const project = scopeProject(state, scope)
    return project ? [project] : []
  }
  return state.projects.filter((project) => !project.archived)
}

export function scopeTasks(state: AppState, scope: Scope): Task[] {
  const names = new Set(scopeProjects(state, scope).map((project) => project.name))
  return state.tasks.filter((task) => names.has(task.project))
}

export function scopeMilestones(state: AppState, scope: Scope): Milestone[] {
  const names = new Set(scopeProjects(state, scope).map((project) => project.name))
  return state.milestones.filter((milestone) => names.has(milestone.project))
}

export function scopeNotes(state: AppState, scope: Scope): Note[] {
  const ids = new Set(scopeProjects(state, scope).map((project) => project.id))
  return state.notes.filter((note) => ids.has(note.projectId))
}

export function scopeContexts(state: AppState, scope: Scope): ProjectContextEntry[] {
  const ids = new Set(scopeProjects(state, scope).map((project) => project.id))
  return state.contexts.filter((context) => ids.has(context.projectId))
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const query = filter.query?.trim().toLocaleLowerCase()
  return tasks.filter((task) => {
    const matchesProject = !filter.project || task.project === filter.project
    const matchesStatus = !filter.status || task.status === filter.status
    const matchesQuery = !query || `${task.title} ${task.project} ${task.module ?? ''}`.toLocaleLowerCase().includes(query)
    return matchesProject && matchesStatus && matchesQuery
  })
}

/** Cards que bloqueiam este, na ordem em que estão gravados. */
export function taskDependencies(tasks: Task[], task: Task): Task[] {
  return (task.dependsOnIds ?? [])
    .map((id) => tasks.find((item) => item.id === id))
    .filter((item): item is Task => Boolean(item))
}

export type SearchHit =
  | { kind: 'project'; id: string; title: string; subtitle: string; color: string; projectId: string }
  | { kind: 'task'; id: string; title: string; subtitle: string; color: string; projectId: string }
  | { kind: 'note'; id: string; title: string; subtitle: string; projectId: string }
  | { kind: 'milestone'; id: string; title: string; subtitle: string; color: string; projectId: string }
  | { kind: 'context'; id: string; title: string; subtitle: string; projectId: string }

/**
 * Busca do command palette. Reaproveita `filterTasks`/`filterNotes`; projeto, marco e
 * contexto ganham casadores curtos porque não existiam antes. Ordem: prefixo exato,
 * depois substring, depois projeto → tarefa → marco → nota → contexto.
 */
export function searchAll(state: AppState, query: string, limitPerGroup = 5): SearchHit[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []

  const projectById = new Map(state.projects.map((project) => [project.id, project]))
  const rank = (text: string) => text.toLocaleLowerCase().startsWith(normalized) ? 0 : 1
  const byRank = <T,>(items: T[], text: (item: T) => string) =>
    [...items].sort((left, right) => rank(text(left)) - rank(text(right)))

  const projects: SearchHit[] = byRank(
    state.projects.filter((project) =>
      `${project.name} ${project.aliases.join(' ')} ${project.modules.join(' ')}`.toLocaleLowerCase().includes(normalized)),
    (project) => project.name,
  ).slice(0, limitPerGroup).map((project) => ({
    kind: 'project', id: project.id, title: project.name,
    subtitle: project.aliases.length ? `alias ${project.aliases.join(', ')}` : `${project.modules.length} módulos`,
    color: project.color, projectId: project.id,
  }))

  const tasks: SearchHit[] = byRank(filterTasks(state.tasks, { query: normalized }), (task) => task.title)
    .slice(0, limitPerGroup).map((task) => ({
      kind: 'task', id: task.id, title: task.title, subtitle: `${task.project} · ${task.status}`,
      color: task.color, projectId: projectById.get(task.project)?.id ?? '',
    }))

  const milestones: SearchHit[] = byRank(
    state.milestones.filter((milestone) => `${milestone.name} ${milestone.project}`.toLocaleLowerCase().includes(normalized)),
    (milestone) => milestone.name,
  ).slice(0, limitPerGroup).map((milestone) => ({
    kind: 'milestone', id: milestone.id, title: milestone.name, subtitle: milestone.project,
    color: milestone.color, projectId: state.projects.find((project) => project.name === milestone.project)?.id ?? '',
  }))

  const notes: SearchHit[] = byRank(filterNotes(state.notes, normalized), (note) => note.title)
    .slice(0, limitPerGroup).map((note) => ({
      kind: 'note', id: note.id, title: note.title || 'Sem título',
      subtitle: projectById.get(note.projectId)?.name ?? '', projectId: note.projectId,
    }))

  const contexts: SearchHit[] = byRank(
    state.contexts.filter((context) => `${context.title} ${context.content}`.toLocaleLowerCase().includes(normalized)),
    (context) => context.title,
  ).slice(0, limitPerGroup).map((context) => ({
    kind: 'context', id: context.id, title: context.title,
    subtitle: projectById.get(context.projectId)?.name ?? '', projectId: context.projectId,
  }))

  return [...projects, ...tasks, ...milestones, ...notes, ...contexts]
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

/** DD/MM vira MM-DD para comparar sem depender do ano corrente. Sem prazo vai para o fim. */
function dueSortKey(due?: string): string {
  if (!due) return '99-99'
  const [day, month] = due.split('/')
  return `${month}-${day}`
}

/** Ordena o plano por prioridade (P0→P3) e, dentro dela, por prazo mais próximo. Ordem vale só nesta sessão. */
export function sortActionPlanByPriority(state: AppState): AppState {
  const actionPlan = [...state.actionPlan].sort((left, right) => {
    const priorityDiff = priorities.indexOf(left.priority) - priorities.indexOf(right.priority)
    if (priorityDiff !== 0) return priorityDiff
    return dueSortKey(left.due).localeCompare(dueSortKey(right.due))
  })
  return { ...state, actionPlan }
}

/**
 * Reordena e já grava a nova `position` da nota arrastada, como ponto médio entre
 * os vizinhos dela na mesma seção (fixadas ou outras). Assim um arraste é uma
 * gravação só, e a ordem do array continua igual à ordem das posições — invariante
 * que `toAppState` assume ao ordenar por `position`.
 */
export function reorderNotes(state: AppState, draggedId: string, beforeId?: string): AppState {
  const notes = reorder(state.notes, draggedId, beforeId)
  const dragged = notes?.find((note) => note.id === draggedId)
  if (!notes || !dragged) return state
  const group = notes.filter((note) => note.pinned === dragged.pinned)
  const index = group.findIndex((note) => note.id === draggedId)
  const previous = group[index - 1]?.position
  const next = group[index + 1]?.position
  const position = previous === undefined
    ? (next === undefined ? 0 : next - 1)
    : (next === undefined ? previous + 1 : (previous + next) / 2)
  return { ...state, notes: notes.map((note) => note.id === draggedId ? { ...note, position } : note) }
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
    const kind: EntryKind = normalized.includes('trav') ? 'Bug' : 'Melhoria'
    const priority: Priority = normalized.includes('prioridade alta') ? 'P1' : 'P2'
    return {
      title: normalized.includes('planta')
        ? 'Corrigir carregamento automático da planta principal'
        : 'Revisar lentidão no carregamento do mapa',
      summary: 'Falha no carregamento inicial do mapa prejudica navegação e desempenho.',
      project: 'VistaFor',
      module: 'Loteamentos / Mapa',
      kind,
      priority,
      complexity: suggestComplexity(kind, priority),
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
      complexity: suggestComplexity('Tarefa', 'P2'),
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
    complexity: suggestComplexity('Tarefa', 'P3'),
    confidence: 64,
    evidence: ['Não há projeto explícito no texto.', 'Classificação usa contexto recente como hipótese.'],
    duplicates: [],
    action: 'Confirmar projeto e detalhar próxima ação.',
  }
}
