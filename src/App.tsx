'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowLeft, Bell, CalendarBlank, Check, DotsSixVertical, Flag, Gear, House, Kanban as KanbanIcon, ListChecks, MapTrifold, MagnifyingGlass, NotePencil, Plus, ProjectorScreenChart, Sparkle, Table, Tray } from '@phosphor-icons/react'
import { dragHandleProps, reorderKeyProps, useDropZone, type DragItem } from './dnd'
import { addInboxItem, globalScope, projectScope, reorderActionPlan, sortActionPlanByPriority, type AppState, type Scope, type SearchHit, type Task } from './domain'
import type { CurrentUser } from './lib/auth/server'
import { useProjectData, type ProjectActions } from './lib/store'
import { Phase1View, projectSections, type Phase1Section, type ProjectSection } from './phase1'
import { TaskCreateDialog, type TaskCreateDefaults, type TaskCreateInput } from './taskCreate'
import { SignOutButton } from './app/SignOutButton'
import { Button, CommandPalette, EmptyState, Toast, useToast, type CommandAction, type Notify, type PaletteResult } from './ui'

type Section = 'Hoje' | Phase1Section

/**
 * Uma rota global e uma rota de projeto. As duas alimentam as mesmas telas —
 * só o escopo muda. Ver `arquitetura-navegacao.md`.
 */
type Route =
  | { kind: 'global'; section: Section }
  | { kind: 'project'; projectId: string; section: ProjectSection }

type NavItem = { label: Section; icon: typeof House }

const nav: NavItem[] = [
  { label: 'Hoje', icon: House }, { label: 'Projetos', icon: Archive }, { label: 'Planilha', icon: Table },
  { label: 'Kanban', icon: KanbanIcon }, { label: 'Marcos', icon: Flag }, { label: 'Roadmap', icon: MapTrifold }, { label: 'Prazos', icon: CalendarBlank },
  { label: 'Notas', icon: NotePencil }, { label: 'Caixa de entrada', icon: Tray }, { label: 'Revisão IA', icon: Sparkle }, { label: 'Integrações', icon: Gear },
]

const navByLabel = new Map(nav.map((item) => [item.label, item]))
const at = (label: Section) => navByLabel.get(label)!

/** Agrupamento visual da sidebar. Ver Fase 5 do passo de UI/UX. */
const navGroups: { group?: string; items: NavItem[] }[] = [
  { items: [at('Hoje'), at('Projetos')] },
  { group: 'TRABALHO', items: [at('Planilha'), at('Kanban'), at('Roadmap'), at('Prazos'), at('Marcos')] },
  { group: 'ENTRADA', items: [at('Caixa de entrada'), at('Revisão IA'), at('Notas')] },
  { group: 'SISTEMA', items: [at('Integrações')] },
]

/** Duas primeiras palavras do nome; sem nome, dois caracteres do e-mail; sem nada, "?". */
function userInitials(user: CurrentUser): string {
  const source = user.name?.trim() || user.email?.split('@')[0] || ''
  if (!source) return '?'
  if (user.name?.trim()) return source.split(/\s+/).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('')
  return source.slice(0, 2).toUpperCase()
}

export default function App({ initialState, user }: { initialState: AppState; user: CurrentUser }) {
  const [route, setRoute] = useState<Route>({ kind: 'global', section: 'Hoje' })
  const { toast, notify, dismiss } = useToast()
  const { state, setState, actions } = useProjectData(initialState, notify)
  const [createDraft, setCreateDraft] = useState<TaskCreateDefaults | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const activeTasks = useMemo(() => state.actionPlan.filter((task) => task.status !== 'Concluída'), [state.actionPlan])
  const pendingReviewCount = useMemo(() => state.inbox.filter((item) => item.status === 'Aguardando confirmação').length, [state.inbox])
  const scope: Scope = route.kind === 'project' ? projectScope(route.projectId) : globalScope
  const openProject = state.projects.find((project) => route.kind === 'project' && project.id === route.projectId)

  // Atalho global: criar card sem depender da tela aberta. Ver `prd.md` seção 12.10.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (document.querySelector('.ui-modal')) return
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
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

  const paletteActions: CommandAction[] = [
    { kind: 'action', id: 'new-task', title: 'Nova tarefa', subtitle: 'Atalho N' },
    ...nav.map((item) => ({ kind: 'action' as const, id: `nav-${item.label}`, title: item.label, subtitle: 'Navegar' })),
  ]

  function selectPaletteResult(result: PaletteResult) {
    if (result.kind === 'action') {
      if (result.id === 'new-task') return openTaskCreate()
      const label = nav.find((item) => `nav-${item.label}` === result.id)?.label
      if (label) return goGlobal(label)
      return
    }
    const hit = result as SearchHit
    if (hit.kind === 'project') return goProject(hit.projectId, 'Visão geral')
    if (hit.kind === 'task') { goProject(hit.projectId, 'Kanban'); setOpenTaskId(hit.id); return }
    if (hit.kind === 'milestone') return goProject(hit.projectId, 'Marcos')
    if (hit.kind === 'note') return goProject(hit.projectId, 'Notas')
    if (hit.kind === 'context') return goProject(hit.projectId, 'Contexto')
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ProjectorScreenChart size={24} weight="duotone" /></div><span>Central de<br />Projetos</span></div>
      <nav className="nav-list">{navGroups.map(({ group, items }, groupIndex) => <div key={group ?? `top-${groupIndex}`} role="group" aria-label={group ?? 'Principal'} className="nav-group">
        {group && <p className="nav-group-label">{group}</p>}
        {items.map(({ label, icon: Icon }) => {
          const active = route.kind === 'global' && route.section === label
          return <button key={label} aria-label={label} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'active' : ''}`} onClick={() => goGlobal(label)}>
            <Icon size={20} weight={active ? 'fill' : 'regular'} /><span>{label}</span>
          </button>
        })}
      </div>)}</nav>
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
      <div className="profile"><div className="avatar">{userInitials(user)}</div><div><strong>{user.name || user.email || 'Sem nome'}</strong>{user.name && user.email && <small>{user.email}</small>}</div></div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><ProjectorScreenChart size={22} weight="duotone" /> Central</div>
        <button className="search" onClick={() => setPaletteOpen(true)}><MagnifyingGlass size={18} /><span>Buscar tarefas, projetos...</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <button className="topbar-create" onClick={() => openTaskCreate()} title="Nova tarefa (N)"><Plus size={18} weight="bold" /><span>Nova tarefa</span></button>
          <button aria-label={`Notificações${pendingReviewCount ? `, ${pendingReviewCount} pendentes` : ''}`} onClick={() => goGlobal('Caixa de entrada')}><Bell size={20} />{pendingReviewCount > 0 && <b>{pendingReviewCount}</b>}</button>
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

    {paletteOpen && <CommandPalette
      state={state}
      actions={paletteActions}
      onClose={() => setPaletteOpen(false)}
      onSelect={selectPaletteResult}
    />}

    <Toast toast={toast} onDismiss={dismiss} />
  </div>

  function renderMain() {
    const shared = {
      scope, state, setState, actions, notify,
      onBack: () => goGlobal('Hoje'), onOpenProject: goProject, onCreateTask: openTaskCreate,
      openTaskId, onOpenTask: (task: Task) => setOpenTaskId(task.id), onCloseTask: () => setOpenTaskId(null),
    }
    if (route.kind === 'project') return <Phase1View section={route.section} {...shared} />
    if (route.section === 'Hoje') return <Today state={state} setState={setState} actions={actions} activeTasks={activeTasks} notify={notify} onCreateTask={openTaskCreate} />
    return <Phase1View section={route.section} {...shared} />
  }
}

function Today({ state, setState, actions, activeTasks, notify, onCreateTask }: { state: AppState; setState: (state: AppState) => void; actions: ProjectActions; activeTasks: Task[]; notify: Notify; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
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
    notify('Entrada adicionada à caixa de entrada — vale só nesta sessão', 'info')
  }

  function reorder(item: DragItem, beforeTaskId?: string) {
    const next = reorderActionPlan(state, item.id, beforeTaskId)
    if (next === state) return
    setState(next)
    notify('Ordem do plano atualizada — vale só nesta sessão', 'info')
  }

  function recalculate() {
    setState(sortActionPlanByPriority(state))
    notify('Plano reordenado por prioridade e prazo — vale só nesta sessão', 'info')
  }

  const withDue = activeTasks.filter((task) => task.due).length
  const focusCopy = activeTasks.length
    ? { title: activeTasks[0]!.title, detail: `${activeTasks.length} em aberto · ${withDue} com prazo` }
    : { title: 'Plano vazio', detail: 'Adicione uma tarefa ao plano de ação.' }

  return <>
    <div className="page-heading">
      <div><h1>Hoje</h1></div>
      <div className="focus-note"><Sparkle size={20} /><div><strong>Foco do dia</strong><span>{focusCopy.title} — {focusCopy.detail}</span></div></div>
    </div>

    <div className="today-grid">
      <section className="plan-panel">
        <div className="panel-title">
          <h2><ListChecks size={22} weight="duotone" /> Plano de ação</h2>
          <Button trailing={<Sparkle size={16} />} onClick={recalculate}>Recalcular</Button>
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
              <div><Button onClick={() => { setShowCapture(false); setInboxText('') }}>Cancelar</Button><Button variant="primary" disabled={!inboxText.trim()} onClick={capture}>Salvar captura</Button></div>
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

  function moveByKeyboard(taskId: string, direction: -1 | 1) {
    const index = tasks.findIndex((task) => task.id === taskId)
    if (index < 0) return
    const beforeId = direction === -1 ? tasks[index - 1]?.id : tasks[index + 2]?.id
    if (direction === -1 && index === 0) return
    if (direction === 1 && index === tasks.length - 1) return
    onReorder({ type: 'plan', id: taskId, from: 'plan' }, beforeId)
  }

  return <div className={`timeline ${zone.active ? 'drop-active' : ''}`} {...zone.dropProps}>
    {tasks.length === 0 && <EmptyState size="inline" icon={<ListChecks size={24} />} title="Plano vazio" description="Nenhuma tarefa em aberto. Adicione a próxima ação ao plano de ação." />}
    {tasks.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onReorder={onReorder} onMove={(direction) => moveByKeyboard(task.id, direction)} onFinish={() => onFinish(task)} />)}
    <button className="add-plan" onClick={onAdd}><Plus size={20} />Adicionar tarefa ao plano</button>
  </div>
}

function TaskRow({ task, first, onReorder, onMove, onFinish }: { task: Task; first: boolean; onReorder: (item: DragItem, beforeTaskId?: string) => void; onMove: (direction: -1 | 1) => void; onFinish: () => void }) {
  const zone = useDropZone((item) => item.type === 'plan' && item.id !== task.id, (item) => onReorder(item, task.id))

  return <article
    className={`task-row ${first ? 'first' : ''} ${zone.over ? 'drop-before' : ''}`}
    {...dragHandleProps({ type: 'plan', id: task.id, from: 'plan' })}
    {...reorderKeyProps(onMove)}
    aria-label={`${task.title}. Alt seta para cima ou para baixo reordena.`}
    {...zone.dropProps}
  >
    <div className="task-time"><span>{task.due ?? 'Sem prazo'}</span></div>
    <div className="task-node" style={{ '--task-color': task.color } as React.CSSProperties} />
    <div className="task-card">
      <div>
        <small className="project-name" style={{ color: task.color }}>{task.project}</small>
        <h3>{task.title}</h3>
        <div className="task-meta">
          <span>{task.priority}</span>
          <span className="dot">•</span>
          <span>Complexidade {task.complexity ? task.complexity.toLocaleLowerCase() : 'a estimar'}</span>
          {Boolean(task.dependsOnIds?.length) && <><span className="dot">•</span><span>{task.dependsOnIds!.length} dependência{task.dependsOnIds!.length > 1 ? 's' : ''}</span></>}
        </div>
      </div>
      <div className="task-card-actions">
        <DotsSixVertical className="drag-grip" size={16} />
        {first && <Button variant="primary" icon={<Check size={18} weight="bold" />} onClick={onFinish}>Concluir</Button>}
      </div>
    </div>
  </article>
}
