'use client'

import { ArrowRight, CalendarBlank, CaretDown, DotsSixVertical, Flag, Kanban, MagicWand, MapTrifold, Plus, Table, Target, X } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { ContextReviewQueue, SmartInboxView } from './contextFlow'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { complexities, filterTasks, filterTasksByMilestone, groupTasksByStatus, priorities, projectTags, scopeContexts, scopeMilestones, scopeProject, scopeProjects, scopeTasks, taskDependencies, taskStatuses, taskTags, type AppState, type Complexity, type MilestoneFilter, type Priority, type Project, type ProjectContextEntry, type Scope, type Tag, type Task, type TaskStatus } from './domain'
import type { ProjectActions, TaskHistoryEntry } from './lib/store'
import type { TaskPatch } from './lib/mapping'
import { MilestoneBadges, MilestonesView, slug, TaskMilestoneSelector } from './milestones'
import { NotesView } from './notes'
import { RoadmapView } from './roadmapView'
import type { TaskCreateDefaults } from './taskCreate'
import { ConfirmDialog, Modal } from './ui'

export type Phase1Section = 'Projetos' | 'Planilha' | 'Kanban' | 'Marcos' | 'Roadmap' | 'Prazos' | 'Notas' | 'Caixa de entrada' | 'Revisão IA' | 'Integrações'

/** Seções que existem dentro de um projeto. Ver `arquitetura-navegacao.md`. */
export type ProjectSection = 'Visão geral' | 'Planilha' | 'Kanban' | 'Marcos' | 'Roadmap' | 'Prazos' | 'Notas' | 'Contexto'

export const projectSections: ProjectSection[] = ['Visão geral', 'Planilha', 'Kanban', 'Marcos', 'Roadmap', 'Prazos', 'Notas', 'Contexto']

const statuses = taskStatuses
const wipLimit: Partial<Record<TaskStatus, number>> = { 'Em andamento': 3 }

export function Phase1View({ section, scope, state, setState, actions, notify, onBack, onOpenProject, onCreateTask }: { section: Phase1Section | ProjectSection; scope: Scope; state: AppState; setState: (state: AppState) => void; actions: ProjectActions; notify: (message: string) => void; onBack: () => void; onOpenProject: (projectId: string) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // O detalhe lê do estado, não de uma cópia: assim o rollback de uma escrita
  // falha aparece no painel aberto em vez de ficar mostrando o valor otimista.
  const selected = state.tasks.find((task) => task.id === selectedId) ?? null
  const openTask = (task: Task) => setSelectedId(task.id)
  const changeStatus = (task: Task, status: TaskStatus) => { void actions.moveTask(task.id, status) }
  const changeMilestones = (task: Task, milestoneIds: string[]) => { void actions.setTaskMilestones(task.id, milestoneIds) }
  const changeTags = (task: Task, tagIds: string[]) => { void actions.setTaskTags(task.id, tagIds) }
  const changeTask = (task: Task, patch: TaskPatch) => { void actions.updateTask(task.id, patch) }

  return <>
    {renderSection()}
    {selected && <TaskDetail
      task={selected}
      state={state}
      loadHistory={actions.loadTaskHistory}
      onClose={() => setSelectedId(null)}
      onStatusChange={(status) => changeStatus(selected, status)}
      onMilestonesChange={(ids) => changeMilestones(selected, ids)}
      onTagsChange={(ids) => changeTags(selected, ids)}
      onTaskUpdate={(patch) => changeTask(selected, patch)}
    />}
  </>

  function renderSection() {
    if (section === 'Projetos') return <ProjectsView state={state} actions={actions} onOpenProject={onOpenProject} />
    if (section === 'Visão geral') return <ProjectOverview state={state} scope={scope} onOpenTask={openTask} />
    if (section === 'Planilha') return <SpreadsheetView state={state} scope={scope} onOpen={openTask} onCreateTask={onCreateTask} />
    if (section === 'Kanban') return <KanbanView state={state} scope={scope} actions={actions} onOpen={openTask} onStatusChange={changeStatus} onCreateTask={onCreateTask} />
    if (section === 'Marcos') return <MilestonesView state={state} scope={scope} setState={setState} notify={notify} onOpenTask={openTask} />
    if (section === 'Roadmap') return <><Heading title="Roadmap" icon={<MapTrifold size={34} />} /><RoadmapView state={state} scope={scope} actions={actions} notify={notify} onOpen={openTask} onCreateTask={onCreateTask} /></>
    if (section === 'Prazos') return <DeadlinesView state={state} scope={scope} onOpen={openTask} onCreateTask={onCreateTask} />
    if (section === 'Notas') return <NotesView state={state} scope={scope} actions={actions} notify={notify} />
    if (section === 'Contexto') return <ContextView state={state} scope={scope} actions={actions} onOpenTask={openTask} />
    if (section === 'Caixa de entrada') return <SmartInboxView state={state} setState={setState} actions={actions} notify={notify} />
    if (section === 'Revisão IA') return <ContextReviewQueue state={state} setState={setState} actions={actions} notify={notify} />
    if (section === 'Integrações') return <IntegrationsView notify={notify} />
    return <EmptyView section={section} onBack={onBack} />
  }
}

function Heading({ eyebrow = 'CENTRAL DE PROJETOS', title, icon, subtitle, action }: { eyebrow?: string; title: string; icon?: ReactNode; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading section-heading">
    <div><p className="eyebrow">{eyebrow}</p><h1>{icon}{title}</h1>{subtitle && <p className="heading-subtitle">{subtitle}</p>}</div>
    {action}
  </div>
}

function PriorityPill({ priority }: { priority: Priority }) {
  return <span className={`priority-pill ${priority.toLowerCase()}`}>{priority}</span>
}

function TagChips({ tags, empty }: { tags: Tag[]; empty?: string }) {
  if (!tags.length) return empty ? <span className="tag-chips-empty">{empty}</span> : null
  return <span className="tag-chips">{tags.map((tag) =>
    <span className="tag-chip" key={tag.id} style={{ '--tag-color': tag.color } as React.CSSProperties}>{tag.name}</span>)}</span>
}

function ProjectsView({ state, actions, onOpenProject }: { state: AppState; actions: ProjectActions; onOpenProject: (projectId: string) => void }) {
  const empty = { name: '', description: '', priority: 'P2' as Priority, aliases: '', modules: '', tags: '' }
  const [form, setForm] = useState<typeof empty | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<Project | null>(null)
  const patch = (value: Partial<typeof empty>) => setForm((current) => current ? { ...current, ...value } : current)

  function openCreate() { setEditing(null); setForm(empty) }
  function openEdit(project: Project) {
    setEditing(project.id)
    setForm({
      name: project.name,
      description: project.description,
      priority: project.priority,
      aliases: project.aliases.join(', '),
      modules: project.modules.join(', '),
      tags: project.tags.map((tag) => tag.name).join(', '),
    })
  }

  function save() {
    if (!form) return
    if (!editing) {
      void actions.createProject({ name: form.name, description: form.description, color: '#68d7a7', priority: form.priority })
    } else {
      void actions.saveProject(editing, {
        name: form.name,
        description: form.description,
        priority: form.priority,
        aliases: splitList(form.aliases),
        modules: splitList(form.modules),
        tags: splitList(form.tags),
      })
    }
    setForm(null)
    setEditing(null)
  }

  function archive(project: Project) {
    void actions.toggleArchived(project.id)
    setArchiving(null)
  }

  return <>
    <Heading title="Projetos" subtitle="Quadros ativos e arquivados que alimentam todas as visões." action={<button className="primary-button" onClick={openCreate}><Plus size={18} />Novo projeto</button>} />

    <div className="project-grid">
      {state.projects.map((project) => <article className={`project-card ${project.archived ? 'archived' : ''}`} key={project.id} style={{ '--project-color': project.color } as React.CSSProperties}>
        <button className="project-card-main" onClick={() => onOpenProject(project.id)}>
          <i />
          <div>
            <span className="project-card-top"><strong>{project.name}</strong><PriorityPill priority={project.priority} /></span>
            <span className="project-card-description">{project.description || 'Sem descrição cadastrada.'}</span>
            <div className="progress"><b style={{ width: `${project.progress}%`, background: project.color }} /></div>
            <small>{project.archived ? 'Arquivado' : `${project.progress}% concluído`} · {project.aliases.length} aliases · {project.modules.length} módulos</small>
          </div>
          <ArrowRight size={18} />
        </button>
        <div className="project-card-actions">
          <button className="ghost-button" onClick={() => openEdit(project)}>Editar</button>
          <button className="ghost-button project-archive" onClick={() => setArchiving(project)}>{project.archived ? 'Reativar' : 'Arquivar'}</button>
        </div>
      </article>)}
    </div>

    {form && <Modal
      title={editing ? 'Editar projeto' : 'Novo projeto'}
      eyebrow="PROJETO"
      description={editing ? 'Aliases e módulos alimentam a classificação do agente.' : 'Um projeto é um quadro com tarefas, marcos e contexto próprio.'}
      onClose={() => { setForm(null); setEditing(null) }}
      footer={<>
        <button className="ghost-button" onClick={() => { setForm(null); setEditing(null) }}>Cancelar</button>
        <button className="primary-button" onClick={save}>{editing ? 'Salvar alterações' : 'Criar projeto'}</button>
      </>}
    >
      <div className="ui-form">
        <label>Nome<input autoFocus value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Nome do projeto" /></label>
        <label>Descrição<input value={form.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Objetivo ou contexto" /></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        {editing && <>
          <label className="ui-form-wide">Aliases separados por vírgula<input value={form.aliases} onChange={(event) => patch({ aliases: event.target.value })} placeholder="PAX, nome antigo" /></label>
          <label className="ui-form-wide">Módulos separados por vírgula<input value={form.modules} onChange={(event) => patch({ modules: event.target.value })} placeholder="Mapa, API" /></label>
          <label className="ui-form-wide">Etiquetas separadas por vírgula<input value={form.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder="raster, CEGEO" /><small>Etiqueta em uso por algum card permanece mesmo se sair desta lista.</small></label>
        </>}
      </div>
    </Modal>}

    {archiving && <ConfirmDialog
      title={archiving.archived ? 'Reativar projeto' : 'Arquivar projeto'}
      description={archiving.archived
        ? `"${archiving.name}" volta a aparecer no Kanban e nos filtros.`
        : `"${archiving.name}" sai do Kanban e dos filtros. As tarefas são preservadas.`}
      confirmLabel={archiving.archived ? 'Reativar' : 'Arquivar'}
      tone={archiving.archived ? 'default' : 'danger'}
      onConfirm={() => archive(archiving)}
      onCancel={() => setArchiving(null)}
    />}
  </>
}

function ProjectOverview({ state, scope, onOpenTask }: { state: AppState; scope: Scope; onOpenTask: (task: Task) => void }) {
  const project = scopeProject(state, scope)
  const tasks = scopeTasks(state, scope)
  const milestones = scopeMilestones(state, scope)
  if (!project) return <div className="empty-state"><X size={40} /><h2>Projeto não encontrado</h2><p>Ele pode ter sido removido.</p></div>

  const groups = groupTasksByStatus(tasks)
  const open = tasks.filter((task) => task.status !== 'Concluída' && task.status !== 'Cancelada')
  const nextAction = open[0]
  const nextMilestone = milestones
    .filter((milestone) => milestone.status !== 'Atingido' && milestone.status !== 'Cancelado')
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))[0]

  return <>
    <Heading eyebrow="PROJETO" title={project.name} subtitle={project.description || 'Sem descrição cadastrada.'} action={<PriorityPill priority={project.priority} />} />

    <div className="overview-grid">
      <section className="view-panel overview-progress">
        <small>PROGRESSO</small>
        <strong>{project.progress}%</strong>
        <div className="progress"><b style={{ width: `${project.progress}%`, background: project.color }} /></div>
        <span>{groups['Concluída'].length} de {tasks.length} cards concluídos</span>
      </section>

      <section className="view-panel overview-next">
        <small>PRÓXIMA AÇÃO</small>
        {nextAction
          ? <button className="overview-link" onClick={() => onOpenTask(nextAction)}><strong>{nextAction.title}</strong><span>{nextAction.status} · {nextAction.due ?? 'Sem prazo'}</span></button>
          : <p>Nenhum card em aberto.</p>}
      </section>

      <section className="view-panel overview-next">
        <small>PRÓXIMO MARCO</small>
        {nextMilestone
          ? <div><strong>{nextMilestone.name}</strong><span>{nextMilestone.status} · {nextMilestone.targetDate}</span></div>
          : <p>Nenhum marco pendente.</p>}
      </section>
    </div>

    <div className="overview-grid">
      <section className="view-panel">
        <h3>Cards por status</h3>
        <ul className="overview-status-list">
          {statuses.map((status) => <li key={status}>
            <span className={`status-pill ${statusClass(status)}`}>{status}</span>
            <b>{groups[status].length}</b>
          </li>)}
        </ul>
      </section>

      <section className="view-panel">
        <h3>Atenção</h3>
        <ul className="overview-status-list">
          <li><span>Bloqueados</span><b>{groups.Bloqueada.length}</b></li>
          <li><span>Sem prazo</span><b>{open.filter((task) => !task.due).length}</b></li>
          <li><span>Sem marco</span><b>{open.filter((task) => !task.milestoneIds?.length).length}</b></li>
        </ul>
      </section>

      <section className="view-panel">
        <h3>Vocabulário</h3>
        <p className="overview-tags">{project.aliases.length ? project.aliases.map((alias) => <span key={alias}>{alias}</span>) : <em>Nenhum alias cadastrado.</em>}</p>
        <h3>Módulos</h3>
        <p className="overview-tags">{project.modules.length ? project.modules.map((module) => <span key={module}>{module}</span>) : <em>Nenhum módulo cadastrado.</em>}</p>
        <h3>Etiquetas</h3>
        {project.tags.length
          ? <TagChips tags={project.tags} />
          : <p className="overview-tags"><em>Nenhuma etiqueta cadastrada.</em></p>}
      </section>
    </div>
  </>
}

function SpreadsheetView({ state, scope, onOpen, onCreateTask }: { state: AppState; scope: Scope; onOpen: (task: Task) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const [query, setQuery] = useState(''); const [project, setProject] = useState(''); const [module, setModule] = useState(''); const [status, setStatus] = useState<TaskStatus | ''>('')
  const scoped = scopeProject(state, scope)
  const inScope = scopeTasks(state, scope)
  const tasks = filterTasks(inScope, { query, project: project || undefined, status: status || undefined })
    .filter((task) => !module || (task.module ?? 'Geral') === module)
  const active = scopeProjects(state, scope)
  // No escopo de projeto a coluna Projeto é redundante; Módulo assume o recorte.
  const modules = scoped ? [...new Set(inScope.map((task) => task.module ?? 'Geral'))].sort() : []

  return <>
    <Heading
      title="Planilha"
      icon={<Table size={34} />}
      subtitle={scoped ? `Cards de ${scoped.name} em formato tabular.` : 'Mesma base do Kanban e do roadmap, em formato tabular.'}
      action={<button className="primary-button" onClick={() => onCreateTask({ module: module || undefined })}><Plus size={18} />Nova tarefa</button>}
    />

    <div className="view-panel table-panel">
      <div className="view-toolbar">
        <input aria-label="Buscar tarefas" placeholder="Buscar tarefas..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {scoped
          ? <select aria-label="Filtrar módulo" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="">Todos módulos</option>
            {modules.map((item) => <option key={item}>{item}</option>)}
          </select>
          : <select aria-label="Filtrar projeto" value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">Todos projetos</option>
            {active.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>}
        <select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | '')}>
          <option value="">Todos status</option>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="result-count">{tasks.length} registros</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Tarefa</th>{!scoped && <th>Projeto</th>}<th>Módulo</th><th>Tipo</th><th>Status</th><th>Prioridade</th><th>Etiquetas</th><th>Prazo</th><th>Previsão</th><th>Dependência</th></tr></thead>
          <tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onOpen(task)}>
            <td><strong>{task.title}</strong><small>{task.complexity ? `Complexidade ${task.complexity.toLocaleLowerCase()}` : 'Sem complexidade'}</small></td>
            {!scoped && <td><span className="table-project"><i style={{ background: task.color }} />{task.project}</span></td>}
            <td>{task.module ?? 'Geral'}</td>
            <td>{task.kind ?? 'Tarefa'}</td>
            <td><span className={`status-pill ${statusClass(task.status)}`}>{task.status}</span></td>
            <td><PriorityPill priority={task.priority} /></td>
            <td><TagChips tags={taskTags(state, task)} empty="—" /></td>
            <td>{task.due ?? 'Sem prazo'}</td>
            <td>{task.forecast ?? '—'}</td>
            <td>{taskDependencies(state.tasks, task).map((item) => item.title).join(', ') || '—'}</td>
          </tr>)}</tbody>
        </table>
        {!tasks.length && <div className="table-empty"><Table size={26} /><strong>Nenhuma tarefa com esses filtros</strong><span>Ajuste a busca ou crie uma nova tarefa.</span></div>}
      </div>
    </div>
  </>
}

function KanbanView({ state, scope, actions, onOpen, onStatusChange, onCreateTask }: { state: AppState; scope: Scope; actions: ProjectActions; onOpen: (task: Task) => void; onStatusChange: (task: Task, status: TaskStatus) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>('')
  const scoped = scopeProject(state, scope)
  const milestones = scopeMilestones(state, scope)
  const visibleTasks = filterTasksByMilestone(scopeTasks(state, scope), milestoneFilter)
  const groups = groupTasksByStatus(visibleTasks)
  const activeMilestone = milestones.find((milestone) => milestone.id === milestoneFilter)

  function drop(item: DragItem, status: TaskStatus, beforeTaskId?: string) {
    void actions.moveTask(item.id, status, beforeTaskId)
  }

  return <>
    <Heading title="Kanban" icon={<Kanban size={34} />} subtitle={scoped ? `Fluxo de ${scoped.name}. Arraste os cards entre colunas para mudar o status.` : 'Arraste os cards entre colunas para mudar o status.'} />
    <div className="kanban-milestone-toolbar">
      <div><Flag size={18} /><span><strong>Marco</strong><small>{activeMilestone ? activeMilestone.description : 'Filtre o fluxo por ponto-chave do projeto'}</small></span></div>
      <select aria-label="Filtrar Kanban por marco" value={milestoneFilter} onChange={(event) => setMilestoneFilter(event.target.value)}>
        <option value="">Todos os marcos</option>
        <option value="unassigned">Sem marco</option>
        {milestones.map((milestone) => <option value={milestone.id} key={milestone.id}>{scoped ? milestone.name : `${milestone.project} · ${milestone.name}`}</option>)}
      </select>
      <b>{visibleTasks.length} tasks</b>
    </div>
    <div className="kanban-board">
      {statuses.map((status) => <KanbanColumn
        key={status}
        status={status}
        tasks={groups[status]}
        milestones={milestones}
        onDrop={drop}
        onOpen={onOpen}
        onStatusChange={onStatusChange}
        // Criar com marco filtrado vincula o card ao marco. Ver `prd.md` 12.5.
        onCreate={() => onCreateTask({ status, milestoneIds: milestoneFilter && milestoneFilter !== 'unassigned' ? [milestoneFilter] : [] })}
      />)}
    </div>
  </>
}

function KanbanColumn({ status, tasks, milestones, onDrop, onOpen, onStatusChange, onCreate }: {
  status: TaskStatus
  tasks: Task[]
  milestones: AppState['milestones']
  onDrop: (item: DragItem, status: TaskStatus, beforeTaskId?: string) => void
  onOpen: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onCreate: () => void
}) {
  const zone = useDropZone((item) => item.type === 'task', (item) => onDrop(item, status))
  const limit = wipLimit[status]
  const overLimit = limit !== undefined && tasks.length > limit

  return <section className={`kanban-column ${statusClass(status)} ${zone.over ? 'drop-over' : ''} ${zone.active ? 'drop-active' : ''}`} {...zone.dropProps}>
    <header>
      <h2><i />{status}</h2>
      <em className={overLimit ? 'over-limit' : ''}>{tasks.length}{limit !== undefined ? `/${limit}` : ''}</em>
      <button className="column-add" aria-label={`Nova tarefa em ${status}`} onClick={onCreate}><Plus size={15} weight="bold" /></button>
    </header>
    <div className="kanban-list">
      {tasks.map((task) => <KanbanCard
        key={task.id}
        task={task}
        status={status}
        milestones={milestones}
        onDropBefore={(item) => onDrop(item, status, task.id)}
        onOpen={() => onOpen(task)}
        onStatusChange={(next) => onStatusChange(task, next)}
      />)}
      <div className={`kanban-drop-hint ${zone.over ? 'visible' : ''}`}>Soltar em {status}</div>
      {!tasks.length && !zone.active && <p className="kanban-empty">Nenhum card</p>}
    </div>
  </section>
}

function KanbanCard({ task, status, milestones, onDropBefore, onOpen, onStatusChange }: {
  task: Task
  status: TaskStatus
  milestones: AppState['milestones']
  onDropBefore: (item: DragItem) => void
  onOpen: () => void
  onStatusChange: (status: TaskStatus) => void
}) {
  const zone = useDropZone((item) => item.type === 'task' && item.id !== task.id, onDropBefore)

  return <article
    className={`kanban-card ${zone.over ? 'drop-before' : ''}`}
    style={{ '--project-color': task.color } as React.CSSProperties}
    onClick={(event) => { if (!(event.target as HTMLElement).closest('select')) onOpen() }}
    {...dragHandleProps({ type: 'task', id: task.id, from: status })}
    {...zone.dropProps}
  >
    <div className="kanban-card-top">
      <span className="kanban-card-project"><i />{task.project}</span>
      <PriorityPill priority={task.priority} />
      <DotsSixVertical className="drag-grip" size={15} />
    </div>
    <strong>{task.title}</strong>
    <MilestoneBadges milestoneIds={task.milestoneIds} milestones={milestones} />
    <div className="kanban-card-foot">
      <span className={task.due ? 'has-due' : ''}><CalendarBlank size={12} />{task.due ?? 'Sem prazo'}</span>
      <label className="kanban-card-move">
        <select aria-label={`Status de ${task.title}`} value={task.status} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <CaretDown size={11} />
      </label>
    </div>
  </article>
}

function DeadlinesView({ state, scope, onOpen, onCreateTask }: { state: AppState; scope: Scope; onOpen: (task: Task) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const scoped = scopeProject(state, scope)
  const inScope = scopeTasks(state, scope)
  const scheduled = inScope.filter((task) => task.due && task.status !== 'Concluída')
  const withoutDue = inScope.filter((task) => !task.due && task.status !== 'Concluída')
  const byDay = [...new Set(scheduled.map((task) => task.due as string))].sort(compareDue)

  return <>
    <Heading
      title="Prazos"
      icon={<CalendarBlank size={34} />}
      subtitle={scoped ? `Datas de ${scoped.name}, agrupadas por dia. Nada é adiado automaticamente.` : 'Tudo que tem data, agrupado por dia. Nada é adiado automaticamente.'}
      action={<button className="primary-button" onClick={() => onCreateTask()}><Plus size={18} />Nova tarefa</button>}
    />
    <div className="deadline-groups">
      {byDay.map((due) => <section className="deadline-group" key={due}>
        <header><strong>{due}</strong><span>{scheduled.filter((task) => task.due === due).length} tarefas</span></header>
        <div className="deadline-grid">
          {scheduled.filter((task) => task.due === due).map((task) => <button className="deadline-card" key={task.id} onClick={() => onOpen(task)} style={{ '--project-color': task.color } as React.CSSProperties}>
            <i />
            <div><strong>{task.title}</strong><small>{task.project} · {task.status}</small></div>
            <PriorityPill priority={task.priority} />
          </button>)}
        </div>
      </section>)}
      {!byDay.length && <div className="view-panel empty-context"><CalendarBlank size={30} /><strong>Nenhum prazo cadastrado</strong><span>Defina prazos no detalhe do card ou arrastando no roadmap.</span></div>}
    </div>
    <div className="view-panel no-deadline">
      <Target size={22} />
      <div><strong>{withoutDue.length} tarefas sem prazo</strong><span>Arraste do roadmap para um dia ou edite o card para definir uma data.</span></div>
    </div>
  </>
}

const historyLabels: Record<string, string> = {
  'task.created': 'Card criado',
  'task.updated': 'Card editado',
  'task.moved': 'Status alterado',
}

function TaskDetail({ task, state, loadHistory, onClose, onStatusChange, onMilestonesChange, onTagsChange, onTaskUpdate }: { task: Task; state: AppState; loadHistory: (taskId: string) => Promise<TaskHistoryEntry[]>; onClose: () => void; onStatusChange: (status: TaskStatus) => void; onMilestonesChange: (milestoneIds: string[]) => void; onTagsChange: (tagIds: string[]) => void; onTaskUpdate: (patch: TaskPatch) => void }) {
  const emptyDraft = {
    title: task.title,
    description: task.description ?? '',
    module: task.module ?? '',
    priority: task.priority,
    due: task.due ?? '',
    forecast: task.forecast ?? '',
    complexity: task.complexity ?? '' as Complexity | '',
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [history, setHistory] = useState<TaskHistoryEntry[] | null>(null)
  const patch = (value: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...value }))
  // Cards ainda não persistidos (criação otimista em voo) não têm trilha para ler.
  const dependencyOptions = state.tasks.filter((item) => item.project === task.project && item.id !== task.id)
  const availableTags = projectTags(state, task.project)

  useEffect(() => {
    let active = true
    setHistory(null)
    loadHistory(task.id).then((entries) => { if (active) setHistory(entries) }).catch(() => { if (active) setHistory([]) })
    return () => { active = false }
  }, [task.id, loadHistory])

  return <Modal
    variant="sheet"
    size="lg"
    accent={task.color}
    eyebrow={task.project}
    title={task.title}
    onClose={onClose}
    closeLabel="Fechar detalhe da tarefa"
    footer={editing
      ? <>
        <button className="ghost-button" onClick={() => { setDraft(emptyDraft); setEditing(false) }}>Cancelar</button>
        <button className="primary-button" onClick={() => { onTaskUpdate({ ...draft, complexity: draft.complexity || undefined }); setEditing(false) }}>Salvar card</button>
      </>
      : <button className="primary-button" onClick={() => setEditing(true)}>Editar card</button>}
  >
    {editing
      ? <div className="ui-form">
        <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label className="ui-form-wide">Descrição<textarea value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="O que precisa ser feito, e por quê." /></label>
        <label>Módulo<input value={draft.module} onChange={(event) => patch({ module: event.target.value })} /></label>
        <label>Prioridade<select value={draft.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prazo confirmado<input value={draft.due} onChange={(event) => patch({ due: event.target.value })} placeholder="DD/MM" /></label>
        <label>Previsão de entrega<input value={draft.forecast} onChange={(event) => patch({ forecast: event.target.value })} placeholder="DD/MM" /></label>
        <label>Complexidade<select value={draft.complexity} onChange={(event) => patch({ complexity: event.target.value as Complexity | '' })}>
          <option value="">A estimar</option>
          {complexities.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <p className="ui-form-hint ui-form-wide">Prazo é compromisso; previsão é estimativa. Previsão vencida vira alerta, não atraso.</p>
      </div>
      : <>
        <div className="detail-facts">
          <label className="detail-status">STATUS
            <select value={task.status} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
          </label>
          <div><small>MÓDULO</small><strong>{task.module ?? 'Geral'}</strong></div>
          <div><small>TIPO</small><strong>{task.kind ?? 'Tarefa'}</strong></div>
          <div><small>PRIORIDADE</small><strong><PriorityPill priority={task.priority} /></strong></div>
          <div><small>COMPLEXIDADE</small><strong>{task.complexity ?? 'A estimar'}</strong></div>
          <div><small>PRAZO</small><strong>{task.due ?? 'Sem prazo'}</strong></div>
          <div><small>PREVISÃO</small><strong>{task.forecast ?? 'A estimar'}</strong></div>
        </div>
        {task.description && <section className="detail-block">
          <h3>Descrição</h3>
          <p className="detail-description">{task.description}</p>
        </section>}
        <section className="detail-block">
          <h3>Etiquetas</h3>
          {availableTags.length
            ? <div className="tag-selector">{availableTags.map((tag) => {
              const linked = task.tagIds?.includes(tag.id) ?? false
              return <label key={tag.id} className={`tag-option ${linked ? 'active' : ''}`} style={{ '--tag-color': tag.color } as React.CSSProperties}>
                <input
                  type="checkbox"
                  checked={linked}
                  onChange={() => onTagsChange(linked
                    ? (task.tagIds ?? []).filter((id) => id !== tag.id)
                    : [...(task.tagIds ?? []), tag.id])}
                />
                <i />
                <span>{tag.name}</span>
              </label>
            })}</div>
            : <p>Nenhuma etiqueta cadastrada neste projeto. Crie na edição do projeto.</p>}
        </section>
        <section className="detail-block">
          <h3>Marcos</h3>
          <TaskMilestoneSelector task={task} milestones={state.milestones} onChange={onMilestonesChange} />
        </section>
        <section className="detail-block">
          <h3>Depende de</h3>
          {dependencyOptions.length
            ? <div className="dependency-options">{dependencyOptions.map((item) => {
              const linked = task.dependsOnIds?.includes(item.id) ?? false
              return <label key={item.id} className={`dependency-option ${linked ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={linked}
                  onChange={() => onTaskUpdate({
                    dependsOnIds: linked
                      ? (task.dependsOnIds ?? []).filter((id) => id !== item.id)
                      : [...(task.dependsOnIds ?? []), item.id],
                  })}
                />
                <span>{item.title}</span>
                <small>{item.status}</small>
              </label>
            })}</div>
            : <p>Nenhum outro card neste projeto para depender.</p>}
        </section>
        <section className="detail-block">
          <h3>Histórico</h3>
          {history === null && <p>Carregando histórico...</p>}
          {history?.length === 0 && <p>Nenhum evento registrado para este card.</p>}
          {history?.map((entry) => <p key={entry.id}>
            {historyLabels[entry.action] ?? entry.action} · {formatHistoryDate(entry.createdAt)}
          </p>)}
        </section>
      </>}
  </Modal>
}

/**
 * Contexto do projeto (PRD 12.9). Nesta fase cobre o que a Fase 3 pede: registro
 * vinculado ao projeto e, opcionalmente, a um card. Pessoas, tecnologias,
 * repositórios, expiração e regras aprendidas entram na Fase 4.
 */
function ContextView({ state, scope, actions, onOpenTask }: { state: AppState; scope: Scope; actions: ProjectActions; onOpenTask: (task: Task) => void }) {
  const project = scopeProject(state, scope)
  const contexts = scopeContexts(state, scope)
  const tasks = scopeTasks(state, scope)
  const emptyDraft = { title: '', content: '', taskId: '' }
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null)
  const [editing, setEditing] = useState<ProjectContextEntry | null>(null)
  const [removing, setRemoving] = useState<ProjectContextEntry | null>(null)
  if (!project) return <div className="empty-state"><X size={40} /><h2>Projeto não encontrado</h2><p>Ele pode ter sido removido.</p></div>

  function save() {
    if (!draft) return
    void actions.createContext({ projectId: project!.id, title: draft.title, content: draft.content, taskId: draft.taskId || undefined })
    setDraft(null)
  }

  function saveEdit(context: ProjectContextEntry, next: typeof emptyDraft) {
    void actions.saveContext(context.id, { title: next.title, content: next.content, taskId: next.taskId || undefined })
    setEditing(null)
  }

  function remove(context: ProjectContextEntry) {
    void actions.removeContext(context.id)
    setRemoving(null)
  }

  return <>
    <Heading
      eyebrow="PROJETO"
      title="Contexto"
      icon={<Target size={34} />}
      subtitle={`O que o agente sabe sobre ${project.name}. Diferente das notas, o contexto fica disponível para IA e MCP.`}
      action={<button className="primary-button" onClick={() => setDraft(emptyDraft)}><Plus size={18} />Novo contexto</button>}
    />

    <div className="overview-grid">
      <section className="view-panel">
        <h3>Aliases</h3>
        <p className="overview-tags">{project.aliases.length ? project.aliases.map((alias) => <span key={alias}>{alias}</span>) : <em>Nenhum alias cadastrado.</em>}</p>
        <h3>Módulos</h3>
        <p className="overview-tags">{project.modules.length ? project.modules.map((module) => <span key={module}>{module}</span>) : <em>Nenhum módulo cadastrado.</em>}</p>
        <h3>Etiquetas</h3>
        {project.tags.length ? <TagChips tags={project.tags} /> : <p className="overview-tags"><em>Nenhuma etiqueta cadastrada.</em></p>}
        <p className="project-context-hint">Aliases, módulos e etiquetas são editados na tela de Projetos.</p>
      </section>
    </div>

    <div className="project-context-list">
      {contexts.map((context) => {
        const linked = tasks.find((task) => task.id === context.taskId)
        return <article className="view-panel project-context-card" key={context.id}>
          <header>
            <strong>{context.title}</strong>
            <div>
              <button className="ghost-button" onClick={() => setEditing(context)}>Editar</button>
              <button className="ghost-button project-archive" onClick={() => setRemoving(context)}>Remover</button>
            </div>
          </header>
          <p>{context.content}</p>
          <footer>
            <small>{context.createdAt}</small>
            {linked
              ? <button className="project-context-task" onClick={() => onOpenTask(linked)}><i style={{ background: linked.color }} />{linked.title}</button>
              : <small>Sem card vinculado</small>}
          </footer>
        </article>
      })}
      {!contexts.length && <div className="view-panel empty-context">
        <Target size={30} />
        <strong>Nenhum contexto registrado</strong>
        <span>Registre regras, decisões e histórico que a IA precisa conhecer antes de classificar.</span>
      </div>}
    </div>

    {draft && <ContextDialog
      title="Novo contexto"
      draft={draft}
      tasks={tasks}
      onChange={(patch) => setDraft((current) => current && { ...current, ...patch })}
      onClose={() => setDraft(null)}
      onSave={save}
    />}

    {editing && <ContextDialogForExisting
      key={editing.id}
      context={editing}
      tasks={tasks}
      onClose={() => setEditing(null)}
      onSave={(next) => saveEdit(editing, next)}
    />}

    {removing && <ConfirmDialog
      title="Remover contexto"
      description={`"${removing.title}" deixa de alimentar a classificação do agente.`}
      confirmLabel="Remover"
      tone="danger"
      onConfirm={() => remove(removing)}
      onCancel={() => setRemoving(null)}
    />}
  </>
}

type ContextDraft = { title: string; content: string; taskId: string }

/**
 * `onChange` recebe só o campo alterado, e o dono aplica com atualização funcional.
 * Espalhar o `draft` capturado aqui perderia uma alteração quando dois campos mudam
 * no mesmo tick, porque o React agrupa as atualizações.
 */
function ContextDialog({ title, draft, tasks, onChange, onClose, onSave }: {
  title: string
  draft: ContextDraft
  tasks: Task[]
  onChange: (patch: Partial<ContextDraft>) => void
  onClose: () => void
  onSave: () => void
}) {
  return <Modal
    title={title}
    eyebrow="CONTEXTO DO PROJETO"
    description="Fica disponível para a IA e para o MCP. Para algo privado, use Notas."
    onClose={onClose}
    footer={<>
      <button className="ghost-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={!draft.title.trim() || !draft.content.trim()} onClick={onSave}>Salvar contexto</button>
    </>}
  >
    <div className="ui-form">
      <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="A afirmação em uma linha" /></label>
      <label className="ui-form-wide">Conteúdo<textarea value={draft.content} onChange={(event) => onChange({ content: event.target.value })} placeholder="O que a IA precisa saber, e por quê." /></label>
      <label className="ui-form-wide">Card relacionado (opcional)
        <select value={draft.taskId} onChange={(event) => onChange({ taskId: event.target.value })}>
          <option value="">Nenhum</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
      </label>
    </div>
  </Modal>
}

/** Edição carrega o rascunho do contexto aberto; `key` no chamador reinicia o estado. */
function ContextDialogForExisting({ context, tasks, onClose, onSave }: {
  context: ProjectContextEntry
  tasks: Task[]
  onClose: () => void
  onSave: (draft: ContextDraft) => void
}) {
  const [draft, setDraft] = useState<ContextDraft>({ title: context.title, content: context.content, taskId: context.taskId ?? '' })
  return <ContextDialog
    title="Editar contexto"
    draft={draft}
    tasks={tasks}
    onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
    onClose={onClose}
    onSave={() => onSave(draft)}
  />
}

function IntegrationsView({ notify }: { notify: (message: string) => void }) {
  return <>
    <Heading title="Integrações" icon={<Kanban size={34} />} subtitle="Conexões externas sincronizadas com a base local." />
    <div className="integration-grid">
      <section className="view-panel integration-card"><Kanban size={30} /><strong>Trello</strong><span>Conecte quadros, listas e cards na próxima fase.</span><button className="primary-button" onClick={() => notify('Conexão com Trello será configurada na Fase 5')}>Configurar</button></section>
      <section className="view-panel integration-card"><MagicWand size={30} /><strong>IA</strong><span>Revisão de plano ativa com recomendações locais.</span><button className="ghost-button" onClick={() => notify('Revisão da IA aberta')}>Abrir revisão <ArrowRight size={16} /></button></section>
    </div>
  </>
}

function EmptyView({ section, onBack }: { section: string; onBack: () => void }) {
  return <div className="empty-state"><X size={40} /><h2>{section} em organização</h2><p>Essa visão será ligada aos mesmos dados do plano.</p><button onClick={onBack} className="ghost-button">Voltar para Hoje</button></div>
}

const statusClass = slug

function formatHistoryDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Aliases e módulos são digitados como lista separada por vírgula. */
function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function compareDue(left: string, right: string) {
  const [leftDay, leftMonth] = left.split('/')
  const [rightDay, rightMonth] = right.split('/')
  return `${leftMonth}${leftDay}`.localeCompare(`${rightMonth}${rightDay}`)
}
