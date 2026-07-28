'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowLeft, Bell, CalendarBlank, Check, CheckCircle, DotsSixVertical, Flag, Gear, House, Kanban as KanbanIcon, ListChecks, MapTrifold, MagnifyingGlass, NotePencil, Plus, ProjectorScreenChart, Sparkle, Table, Tray } from '@phosphor-icons/react'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { addInboxItem, globalScope, projectScope, reorderActionPlan, type AppState, type Scope, type Task } from './domain'
import { useProjectData, type ProjectActions } from './lib/store'
import { Phase1View, projectSections, type Phase1Section, type ProjectSection } from './phase1'
import { TaskCreateDialog, type TaskCreateDefaults, type TaskCreateInput } from './taskCreate'
import { SignOutButton } from './app/SignOutButton'

type Section = 'Hoje' | Phase1Section

/**
 * Uma rota global e uma rota de projeto. As duas alimentam as mesmas telas —
 * só o escopo muda. Ver `arquitetura-navegacao.md`.
 */
type Route =
  | { kind: 'global'; section: Section }
  | { kind: 'project'; projectId: string; section: ProjectSection }

const nav: { label: Section; icon: typeof House }[] = [
  { label: 'Hoje', icon: House }, { label: 'Projetos', icon: Archive }, { label: 'Planilha', icon: Table },
  { label: 'Kanban', icon: KanbanIcon }, { label: 'Marcos', icon: Flag }, { label: 'Roadmap', icon: MapTrifold }, { label: 'Prazos', icon: CalendarBlank },
  { label: 'Notas', icon: NotePencil }, { label: 'Caixa de entrada', icon: Tray }, { label: 'Revisão IA', icon: Sparkle }, { label: 'Integrações', icon: Gear },
]

export default function App({ initialState }: { initialState: AppState }) {
  const [route, setRoute] = useState<Route>({ kind: 'global', section: 'Hoje' })
  const [toast, setToast] = useState('')
  const { state, setState, actions } = useProjectData(initialState, notify)
  const [createDraft, setCreateDraft] = useState<TaskCreateDefaults | null>(null)
  const activeTasks = useMemo(() => state.actionPlan.filter((task) => task.status !== 'Concluída'), [state.actionPlan])
  const scope: Scope = route.kind === 'project' ? projectScope(route.projectId) : globalScope
  const openProject = state.projects.find((project) => route.kind === 'project' && project.id === route.projectId)

  // Atalho global: criar card sem depender da tela aberta. Ver `prd.md` seção 12.10.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'n' && event.key !== 'N') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.ui-modal')) return
      event.preventDefault()
      setCreateDraft({})
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  function openTaskCreate(defaults: TaskCreateDefaults = {}) {
    setCreateDraft(openProject ? { project: openProject.name, ...defaults } : defaults)
  }

  function createTask(input: TaskCreateInput) {
    setCreateDraft(null)
    void actions.createTask(input)
  }

  function goGlobal(section: Section) {
    setRoute({ kind: 'global', section })
  }

  function goProject(projectId: string, section: ProjectSection = 'Visão geral') {
    setRoute({ kind: 'project', projectId, section })
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ProjectorScreenChart size={24} weight="duotone" /></div><span>Central de<br />Projetos</span></div>
      <nav className="nav-list">{nav.map(({ label, icon: Icon }) => {
        const active = route.kind === 'global' && route.section === label
        return <button key={label} aria-label={label} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'active' : ''}`} onClick={() => goGlobal(label)}>
          <Icon size={20} weight={active ? 'fill' : 'regular'} /><span>{label}</span>
        </button>
      })}</nav>
      <div className="recent">
        <p>PROJETOS RECENTES</p>
        {state.projects.filter((project) => !project.archived).map((project) => <button
          key={project.id}
          className={`recent-project ${route.kind === 'project' && route.projectId === project.id ? 'active' : ''}`}
          onClick={() => goProject(project.id)}
        >
          <i style={{ background: project.color }} />{project.name}<small>{project.priority} · {project.progress}%</small>
        </button>)}
      </div>
      <div className="profile"><div className="avatar">LF</div><div><strong>Lucas Ferreira</strong><small>Foco · Profundo</small></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><ProjectorScreenChart size={22} weight="duotone" /> Central</div>
        <button className="search" onClick={() => notify('Busca global entra na próxima etapa')}><MagnifyingGlass size={18} /><span>Buscar tarefas, projetos...</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <button className="topbar-create" onClick={() => openTaskCreate()} title="Nova tarefa (N)"><Plus size={18} weight="bold" /><span>Nova tarefa</span></button>
          <button aria-label="Notificações" onClick={() => notify('3 avisos pendentes')}><Bell size={20} /><b>3</b></button>
          <button aria-label="Configurações" onClick={() => goGlobal('Integrações')}><Gear size={20} /></button>
          <SignOutButton />
        </div>
      </header>

      {route.kind === 'project' && openProject && <nav className="project-tabs" aria-label={`Seções de ${openProject.name}`}>
        <button className="project-tabs-back" onClick={() => goGlobal('Projetos')}><ArrowLeft size={16} />Projetos</button>
        <span className="project-tabs-name"><i style={{ background: openProject.color }} />{openProject.name}</span>
        {projectSections.map((item) => <button
          key={item}
          aria-current={route.section === item ? 'page' : undefined}
          className={`project-tab ${route.section === item ? 'active' : ''}`}
          onClick={() => goProject(openProject.id, item)}
        >{item}</button>)}
      </nav>}

      {renderMain()}
    </main>

    {createDraft && <TaskCreateDialog
      state={state}
      scope={scope}
      defaults={createDraft}
      onClose={() => setCreateDraft(null)}
      onCreate={createTask}
    />}

    {toast && <div className="toast" role="status"><CheckCircle size={20} weight="fill" />{toast}</div>}
  </div>

  function renderMain() {
    const shared = { scope, state, setState, actions, notify, onBack: () => goGlobal('Hoje'), onOpenProject: goProject, onCreateTask: openTaskCreate }
    if (route.kind === 'project') return <Phase1View section={route.section} {...shared} />
    if (route.section === 'Hoje') return <Today state={state} setState={setState} actions={actions} activeTasks={activeTasks} notify={notify} onCreateTask={openTaskCreate} />
    return <Phase1View section={route.section} {...shared} />
  }
}

function Today({ state, setState, actions, activeTasks, notify, onCreateTask }: { state: AppState; setState: (state: AppState) => void; actions: ProjectActions; activeTasks: Task[]; notify: (message: string) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const [inboxText, setInboxText] = useState('')
  const [showCapture, setShowCapture] = useState(false)

  function finish(task: Task) {
    void actions.completeTask(task.id)
  }

  function capture() {
    const next = addInboxItem(state, inboxText)
    if (next === state) return
    setState(next)
    setInboxText('')
    setShowCapture(false)
    notify('Entrada adicionada à caixa de entrada')
  }

  function reorder(item: DragItem, beforeTaskId?: string) {
    const next = reorderActionPlan(state, item.id, beforeTaskId)
    if (next === state) return
    setState(next)
    notify('Ordem do plano atualizada')
  }

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">CENTRAL DE PROJETOS</p><h1>Hoje</h1></div>
      <div className="focus-note"><Sparkle size={20} /><div><strong>Foco do dia</strong><span>Avançar no módulo de pagamentos e finalizar especificações.</span></div></div>
    </div>

    <div className="today-grid">
      <section className="plan-panel">
        <div className="panel-title">
          <h2><ListChecks size={22} weight="duotone" /> Plano de ação</h2>
          <button className="ghost-button" onClick={() => notify('Plano recalculado com base nas prioridades')}>Recalcular <Sparkle size={16} /></button>
        </div>
        <PlanTimeline tasks={activeTasks} onReorder={reorder} onFinish={finish} onAdd={() => onCreateTask()} />
      </section>

      <aside className="right-column">
        <section className="side-panel">
          <div className="side-title"><h2><CalendarBlank size={21} /> Próximos prazos</h2><button onClick={() => notify('Central de prazos aberta')}>Ver todos</button></div>
          {state.tasks.filter((task) => task.due && task.status !== 'Concluída').slice(0, 4).map((task) => <div className="deadline" key={task.id}>
            <i style={{ background: task.color }} />
            <div><strong>{task.title}</strong><small>{task.project}</small></div>
            <div className="deadline-date"><strong>{task.due}</strong></div>
          </div>)}
        </section>

        <section className="side-panel inbox-panel">
          <div className="side-title"><h2><Tray size={21} /> Caixa de entrada</h2><span>{state.inbox.length}</span></div>
          {showCapture
            ? <div className="capture-form">
              <textarea autoFocus value={inboxText} onChange={(event) => setInboxText(event.target.value)} placeholder="Qualquer ideia, tarefa ou informação rápida..." />
              <div><button className="ghost-button" onClick={() => { setShowCapture(false); setInboxText('') }}>Cancelar</button><button className="primary-button" disabled={!inboxText.trim()} onClick={capture}>Salvar captura</button></div>
            </div>
            : <button className="capture-trigger" onClick={() => setShowCapture(true)}>Nova captura <Plus size={17} /></button>}
          {state.inbox.slice(0, 2).map((item) => <div className="inbox-items" key={item.id}><p>{item.text}</p><small>{item.date} · {item.status}</small></div>)}
        </section>
      </aside>
    </div>
  </>
}

function PlanTimeline({ tasks, onReorder, onFinish, onAdd }: { tasks: Task[]; onReorder: (item: DragItem, beforeTaskId?: string) => void; onFinish: (task: Task) => void; onAdd: () => void }) {
  const zone = useDropZone((item) => item.type === 'plan', (item) => onReorder(item))

  return <div className={`timeline ${zone.active ? 'drop-active' : ''}`} {...zone.dropProps}>
    {tasks.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onReorder={onReorder} onFinish={() => onFinish(task)} />)}
    <button className="add-plan" onClick={onAdd}><Plus size={20} />Adicionar tarefa ao plano</button>
  </div>
}

function TaskRow({ task, first, onReorder, onFinish }: { task: Task; first: boolean; onReorder: (item: DragItem, beforeTaskId?: string) => void; onFinish: () => void }) {
  const zone = useDropZone((item) => item.type === 'plan' && item.id !== task.id, (item) => onReorder(item, task.id))

  return <article
    className={`task-row ${first ? 'first' : ''} ${zone.over ? 'drop-before' : ''}`}
    {...dragHandleProps({ type: 'plan', id: task.id, from: 'plan' })}
    {...zone.dropProps}
  >
    <div className="task-time"><span>{task.due ?? 'Sem prazo'}</span><small>{task.complexity ? `Complexidade ${task.complexity.toLocaleLowerCase()}` : 'A estimar'}</small></div>
    <div className="task-node" style={{ '--task-color': task.color } as React.CSSProperties} />
    <div className="task-card">
      <div>
        <small className="project-name" style={{ color: task.color }}>{task.project}</small>
        <h3>{task.title}</h3>
        <div className="task-meta"><span>{task.priority}</span>{Boolean(task.dependsOnIds?.length) && <><span className="dot">•</span><span>{task.dependsOnIds!.length} dependência{task.dependsOnIds!.length > 1 ? 's' : ''}</span></>}</div>
      </div>
      <div className="task-card-actions">
        <DotsSixVertical className="drag-grip" size={16} />
        {first && <button className="primary-button" onClick={onFinish}><Check size={18} weight="bold" />Concluir</button>}
      </div>
    </div>
  </article>
}
