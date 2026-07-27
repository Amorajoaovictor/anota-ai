'use client'

import { ArrowRight, CalendarBlank, CaretDown, DotsSixVertical, Flag, Kanban, MagicWand, MapTrifold, Plus, Table, Target, X } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { ContextReviewQueue, SmartInboxView } from './contextFlow'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { addProject, addProjectAlias, addProjectModule, addTask, filterTasks, filterTasksByMilestone, groupTasksByStatus, moveTaskTo, removeProjectAlias, removeProjectModule, setTaskMilestones, toggleProjectArchived, updateProject, updateTask, type AppState, type MilestoneFilter, type Priority, type Project, type Task, type TaskStatus } from './domain'
import { MilestoneBadges, MilestonesView, slug, TaskMilestoneSelector } from './milestones'
import { NotesView } from './notes'
import { RoadmapView } from './roadmapView'
import { ConfirmDialog, Modal } from './ui'

export type Phase1Section = 'Projetos' | 'Planilha' | 'Kanban' | 'Marcos' | 'Roadmap' | 'Prazos' | 'Notas' | 'Caixa de entrada' | 'Revisão IA' | 'Integrações'

const statuses: TaskStatus[] = ['Backlog', 'Em andamento', 'Bloqueada', 'Em validação', 'Concluída', 'Cancelada']
const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3']
const wipLimit: Partial<Record<TaskStatus, number>> = { 'Em andamento': 3 }

export function Phase1View({ section, state, setState, notify, onBack }: { section: Phase1Section; state: AppState; setState: (state: AppState) => void; notify: (message: string) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<Task | null>(null)
  const openTask = (task: Task) => setSelected(task)
  const changeStatus = (task: Task, status: TaskStatus) => { setState(moveTaskTo(state, task.id, status)); notify(`Status atualizado: ${status}`); if (selected?.id === task.id) setSelected({ ...task, status }) }
  const changeMilestones = (task: Task, milestoneIds: string[]) => {
    const next = setTaskMilestones(state, task.id, milestoneIds)
    setState(next)
    const updated = next.tasks.find((item) => item.id === task.id)
    if (updated) setSelected(updated)
    notify('Marcos da task atualizados')
  }
  const changeTask = (task: Task, patch: Parameters<typeof updateTask>[2]) => {
    const next = updateTask(state, task.id, patch)
    if (next === state) return notify('Dados inválidos para a tarefa')
    setState(next)
    const updated = next.tasks.find((item) => item.id === task.id)
    if (updated) setSelected(updated)
    notify('Tarefa atualizada')
  }

  return <>
    {renderSection()}
    {selected && <TaskDetail
      task={selected}
      state={state}
      onClose={() => setSelected(null)}
      onStatusChange={(status) => changeStatus(selected, status)}
      onMilestonesChange={(ids) => changeMilestones(selected, ids)}
      onTaskUpdate={(patch) => changeTask(selected, patch)}
    />}
  </>

  function renderSection() {
    if (section === 'Projetos') return <ProjectsView state={state} setState={setState} notify={notify} />
    if (section === 'Planilha') return <SpreadsheetView state={state} setState={setState} onOpen={openTask} />
    if (section === 'Kanban') return <KanbanView state={state} setState={setState} notify={notify} onOpen={openTask} onStatusChange={changeStatus} />
    if (section === 'Marcos') return <MilestonesView state={state} setState={setState} notify={notify} onOpenTask={openTask} />
    if (section === 'Roadmap') return <><Heading title="Roadmap" icon={<MapTrifold size={34} />} /><RoadmapView state={state} setState={setState} notify={notify} onOpen={openTask} /></>
    if (section === 'Prazos') return <DeadlinesView state={state} onOpen={openTask} />
    if (section === 'Notas') return <NotesView state={state} setState={setState} notify={notify} />
    if (section === 'Caixa de entrada') return <SmartInboxView state={state} setState={setState} notify={notify} />
    if (section === 'Revisão IA') return <ContextReviewQueue state={state} setState={setState} notify={notify} />
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

function ProjectsView({ state, setState, notify }: { state: AppState; setState: (state: AppState) => void; notify: (message: string) => void }) {
  const empty = { name: '', description: '', priority: 'P2' as Priority, aliases: '', modules: '' }
  const [form, setForm] = useState<typeof empty | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<Project | null>(null)
  const patch = (value: Partial<typeof empty>) => setForm((current) => current ? { ...current, ...value } : current)

  function openCreate() { setEditing(null); setForm(empty) }
  function openEdit(project: Project) {
    setEditing(project.id)
    setForm({ name: project.name, description: project.description, priority: project.priority, aliases: project.aliases.join(', '), modules: project.modules.join(', ') })
  }

  function save() {
    if (!form) return
    if (!editing) {
      const next = addProject(state, { name: form.name, description: form.description, color: '#68d7a7', priority: form.priority })
      if (next === state) return notify('Informe um nome único para o projeto')
      setState(next); setForm(null); return notify('Projeto criado')
    }
    let next = updateProject(state, editing, { name: form.name, description: form.description, priority: form.priority })
    if (next === state) return notify('Nome inválido ou já usado por outro projeto')
    const current = next.projects.find((project) => project.id === editing)
    if (!current) return
    current.aliases.forEach((alias) => { next = removeProjectAlias(next, editing, alias) })
    form.aliases.split(',').forEach((alias) => { next = addProjectAlias(next, editing, alias) })
    current.modules.forEach((module) => { next = removeProjectModule(next, editing, module) })
    form.modules.split(',').forEach((module) => { next = addProjectModule(next, editing, module) })
    setState(next); setForm(null); setEditing(null); notify('Projeto atualizado')
  }

  function archive(project: Project) {
    setState(toggleProjectArchived(state, project.id))
    notify(project.archived ? 'Projeto reativado' : 'Projeto arquivado')
    setArchiving(null)
  }

  return <>
    <Heading title="Projetos" subtitle="Quadros ativos e arquivados que alimentam todas as visões." action={<button className="primary-button" onClick={openCreate}><Plus size={18} />Novo projeto</button>} />

    <div className="project-grid">
      {state.projects.map((project) => <article className={`project-card ${project.archived ? 'archived' : ''}`} key={project.id} style={{ '--project-color': project.color } as React.CSSProperties}>
        <button className="project-card-main" onClick={() => openEdit(project)}>
          <i />
          <div>
            <span className="project-card-top"><strong>{project.name}</strong><PriorityPill priority={project.priority} /></span>
            <span className="project-card-description">{project.description || 'Sem descrição cadastrada.'}</span>
            <div className="progress"><b style={{ width: `${project.progress}%`, background: project.color }} /></div>
            <small>{project.archived ? 'Arquivado' : `${project.progress}% concluído`} · {project.aliases.length} aliases · {project.modules.length} módulos</small>
          </div>
          <ArrowRight size={18} />
        </button>
        <button className="ghost-button project-archive" onClick={() => setArchiving(project)}>{project.archived ? 'Reativar' : 'Arquivar'}</button>
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

function SpreadsheetView({ state, setState, onOpen }: { state: AppState; setState: (state: AppState) => void; onOpen: (task: Task) => void }) {
  const [query, setQuery] = useState(''); const [project, setProject] = useState(''); const [status, setStatus] = useState<TaskStatus | ''>('')
  const empty = { title: '', project: '', module: '', priority: 'P3' as Priority, due: '' }
  const [form, setForm] = useState<typeof empty | null>(null)
  const patch = (value: Partial<typeof empty>) => setForm((current) => current ? { ...current, ...value } : current)
  const tasks = filterTasks(state.tasks, { query, project: project || undefined, status: status || undefined })
  const active = state.projects.filter((item) => !item.archived)

  function save() {
    if (!form) return
    const next = addTask(state, form)
    if (next === state) return
    setState(next); setForm(null); onOpen(next.tasks[0])
  }

  return <>
    <Heading title="Planilha" icon={<Table size={34} />} subtitle="Mesma base do Kanban e do roadmap, em formato tabular." action={<button className="primary-button" onClick={() => setForm({ ...empty, project: active[0]?.name ?? '' })}><Plus size={18} />Nova tarefa</button>} />

    <div className="view-panel table-panel">
      <div className="view-toolbar">
        <input aria-label="Buscar tarefas" placeholder="Buscar tarefas..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filtrar projeto" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">Todos projetos</option>
          {active.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | '')}>
          <option value="">Todos status</option>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="result-count">{tasks.length} registros</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Tarefa</th><th>Projeto</th><th>Módulo</th><th>Tipo</th><th>Status</th><th>Prioridade</th><th>Prazo</th><th>Dependência</th></tr></thead>
          <tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onOpen(task)}>
            <td><strong>{task.title}</strong><small>{task.duration}</small></td>
            <td><span className="table-project"><i style={{ background: task.color }} />{task.project}</span></td>
            <td>{task.module ?? 'Geral'}</td>
            <td>{task.kind ?? 'Tarefa'}</td>
            <td><span className={`status-pill ${statusClass(task.status)}`}>{task.status}</span></td>
            <td><PriorityPill priority={task.priority} /></td>
            <td>{task.due ?? 'Sem prazo'}</td>
            <td>{task.dependency ?? '—'}</td>
          </tr>)}</tbody>
        </table>
        {!tasks.length && <div className="table-empty"><Table size={26} /><strong>Nenhuma tarefa com esses filtros</strong><span>Ajuste a busca ou crie uma nova tarefa.</span></div>}
      </div>
    </div>

    {form && <Modal
      title="Nova tarefa"
      eyebrow="CARD"
      description="Nasce em Backlog. Prioridade e prazo podem ser ajustados depois."
      onClose={() => setForm(null)}
      footer={<>
        <button className="ghost-button" onClick={() => setForm(null)}>Cancelar</button>
        <button className="primary-button" disabled={!form.title.trim() || !form.project} onClick={save}>Criar tarefa</button>
      </>}
    >
      <div className="ui-form">
        <label className="ui-form-wide">Título<input autoFocus value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="O que precisa ser feito?" /></label>
        <label>Projeto<select value={form.project} onChange={(event) => patch({ project: event.target.value })}>
          <option value="">Selecione</option>
          {active.map((item) => <option key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Módulo<input value={form.module} onChange={(event) => patch({ module: event.target.value })} placeholder="Geral" /></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prazo<input value={form.due} onChange={(event) => patch({ due: event.target.value })} placeholder="DD/MM" /></label>
      </div>
    </Modal>}
  </>
}

function KanbanView({ state, setState, notify, onOpen, onStatusChange }: { state: AppState; setState: (state: AppState) => void; notify: (message: string) => void; onOpen: (task: Task) => void; onStatusChange: (task: Task, status: TaskStatus) => void }) {
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>('')
  const visibleTasks = filterTasksByMilestone(state.tasks.filter((task) => state.projects.some((project) => project.name === task.project && !project.archived)), milestoneFilter)
  const groups = groupTasksByStatus(visibleTasks)
  const activeMilestone = state.milestones.find((milestone) => milestone.id === milestoneFilter)

  function drop(item: DragItem, status: TaskStatus, beforeTaskId?: string) {
    const next = moveTaskTo(state, item.id, status, beforeTaskId)
    if (next === state) return
    setState(next)
    notify(`Card movido para ${status}`)
  }

  return <>
    <Heading title="Kanban" icon={<Kanban size={34} />} subtitle="Arraste os cards entre colunas para mudar o status." />
    <div className="kanban-milestone-toolbar">
      <div><Flag size={18} /><span><strong>Marco</strong><small>{activeMilestone ? activeMilestone.description : 'Filtre o fluxo por ponto-chave do projeto'}</small></span></div>
      <select aria-label="Filtrar Kanban por marco" value={milestoneFilter} onChange={(event) => setMilestoneFilter(event.target.value)}>
        <option value="">Todos os marcos</option>
        <option value="unassigned">Sem marco</option>
        {state.milestones.map((milestone) => <option value={milestone.id} key={milestone.id}>{milestone.project} · {milestone.name}</option>)}
      </select>
      <b>{visibleTasks.length} tasks</b>
    </div>
    <div className="kanban-board">
      {statuses.map((status) => <KanbanColumn
        key={status}
        status={status}
        tasks={groups[status]}
        milestones={state.milestones}
        onDrop={drop}
        onOpen={onOpen}
        onStatusChange={onStatusChange}
      />)}
    </div>
  </>
}

function KanbanColumn({ status, tasks, milestones, onDrop, onOpen, onStatusChange }: {
  status: TaskStatus
  tasks: Task[]
  milestones: AppState['milestones']
  onDrop: (item: DragItem, status: TaskStatus, beforeTaskId?: string) => void
  onOpen: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}) {
  const zone = useDropZone((item) => item.type === 'task', (item) => onDrop(item, status))
  const limit = wipLimit[status]
  const overLimit = limit !== undefined && tasks.length > limit

  return <section className={`kanban-column ${statusClass(status)} ${zone.over ? 'drop-over' : ''} ${zone.active ? 'drop-active' : ''}`} {...zone.dropProps}>
    <header>
      <h2><i />{status}</h2>
      <em className={overLimit ? 'over-limit' : ''}>{tasks.length}{limit !== undefined ? `/${limit}` : ''}</em>
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

function DeadlinesView({ state, onOpen }: { state: AppState; onOpen: (task: Task) => void }) {
  const scheduled = state.tasks.filter((task) => task.due && task.status !== 'Concluída')
  const withoutDue = state.tasks.filter((task) => !task.due && task.status !== 'Concluída')
  const byDay = [...new Set(scheduled.map((task) => task.due as string))].sort(compareDue)

  return <>
    <Heading title="Prazos" icon={<CalendarBlank size={34} />} subtitle="Tudo que tem data, agrupado por dia. Nada é adiado automaticamente." />
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

function TaskDetail({ task, state, onClose, onStatusChange, onMilestonesChange, onTaskUpdate }: { task: Task; state: AppState; onClose: () => void; onStatusChange: (status: TaskStatus) => void; onMilestonesChange: (milestoneIds: string[]) => void; onTaskUpdate: (patch: Parameters<typeof updateTask>[2]) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: task.title, module: task.module ?? '', priority: task.priority, due: task.due ?? '' })
  const patch = (value: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...value }))

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
        <button className="ghost-button" onClick={() => { setDraft({ title: task.title, module: task.module ?? '', priority: task.priority, due: task.due ?? '' }); setEditing(false) }}>Cancelar</button>
        <button className="primary-button" onClick={() => { onTaskUpdate(draft); setEditing(false) }}>Salvar card</button>
      </>
      : <button className="primary-button" onClick={() => setEditing(true)}>Editar card</button>}
  >
    {editing
      ? <div className="ui-form">
        <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label>Módulo<input value={draft.module} onChange={(event) => patch({ module: event.target.value })} /></label>
        <label>Prioridade<select value={draft.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prazo<input value={draft.due} onChange={(event) => patch({ due: event.target.value })} placeholder="DD/MM" /></label>
      </div>
      : <>
        <div className="detail-facts">
          <label className="detail-status">STATUS
            <select value={task.status} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
          </label>
          <div><small>MÓDULO</small><strong>{task.module ?? 'Geral'}</strong></div>
          <div><small>TIPO</small><strong>{task.kind ?? 'Tarefa'}</strong></div>
          <div><small>PRIORIDADE</small><strong><PriorityPill priority={task.priority} /></strong></div>
          <div><small>DURAÇÃO</small><strong>{task.duration}</strong></div>
          <div><small>PRAZO</small><strong>{task.due ?? 'Sem prazo'}</strong></div>
        </div>
        <section className="detail-block">
          <h3>Marcos</h3>
          <TaskMilestoneSelector task={task} milestones={state.milestones} onChange={onMilestonesChange} />
        </section>
        <section className="detail-block">
          <h3>Dependência</h3>
          <p>{task.dependency ?? 'Nenhuma dependência cadastrada.'}</p>
        </section>
        <section className="detail-block">
          <h3>Histórico</h3>
          <p>Tarefa criada no núcleo de projetos.</p>
          <p>Status atual: {task.status}.</p>
        </section>
      </>}
  </Modal>
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

function compareDue(left: string, right: string) {
  const [leftDay, leftMonth] = left.split('/')
  const [rightDay, rightMonth] = right.split('/')
  return `${leftMonth}${leftDay}`.localeCompare(`${rightMonth}${rightDay}`)
}
