'use client'

import { useMemo, useState } from 'react'
import { Archive, Bell, CalendarBlank, Check, CheckCircle, DotsSixVertical, Flag, Gear, House, Kanban as KanbanIcon, ListChecks, MapTrifold, MagnifyingGlass, NotePencil, Plus, ProjectorScreenChart, Sparkle, Table, Tray } from '@phosphor-icons/react'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { addInboxItem, completeTask, initialState, reorderActionPlan, type AppState, type Task } from './domain'
import { Phase1View, type Phase1Section } from './phase1'
import { SignOutButton } from './app/SignOutButton'

type Section = 'Hoje' | Phase1Section

const nav: { label: Section; icon: typeof House }[] = [
  { label: 'Hoje', icon: House }, { label: 'Projetos', icon: Archive }, { label: 'Planilha', icon: Table },
  { label: 'Kanban', icon: KanbanIcon }, { label: 'Marcos', icon: Flag }, { label: 'Roadmap', icon: MapTrifold }, { label: 'Prazos', icon: CalendarBlank },
  { label: 'Notas', icon: NotePencil }, { label: 'Caixa de entrada', icon: Tray }, { label: 'Revisão IA', icon: Sparkle }, { label: 'Integrações', icon: Gear },
]

export default function App() {
  const [section, setSection] = useState<Section>('Hoje')
  const [state, setState] = useState<AppState>(initialState)
  const [toast, setToast] = useState('')
  const activeTasks = useMemo(() => state.actionPlan.filter((task) => task.status !== 'Concluída'), [state.actionPlan])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ProjectorScreenChart size={24} weight="duotone" /></div><span>Central de<br />Projetos</span></div>
      <nav className="nav-list">{nav.map(({ label, icon: Icon }) => <button key={label} aria-label={label} className={`nav-item ${section === label ? 'active' : ''}`} onClick={() => setSection(label)}>
        <Icon size={20} weight={section === label ? 'fill' : 'regular'} /><span>{label}</span>
      </button>)}</nav>
      <div className="recent">
        <p>PROJETOS RECENTES</p>
        {state.projects.filter((project) => !project.archived).map((project) => <button key={project.id} className="recent-project" onClick={() => { setSection('Projetos'); notify(`${project.name} selecionado`) }}>
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
          <button aria-label="Notificações" onClick={() => notify('3 avisos pendentes')}><Bell size={20} /><b>3</b></button>
          <button aria-label="Configurações" onClick={() => setSection('Integrações')}><Gear size={20} /></button>
          <SignOutButton />
        </div>
      </header>
      {section === 'Hoje'
        ? <Today state={state} setState={setState} activeTasks={activeTasks} notify={notify} />
        : <Phase1View section={section} state={state} setState={setState} notify={notify} onBack={() => setSection('Hoje')} />}
    </main>

    {toast && <div className="toast" role="status"><CheckCircle size={20} weight="fill" />{toast}</div>}
  </div>
}

function Today({ state, setState, activeTasks, notify }: { state: AppState; setState: (state: AppState) => void; activeTasks: Task[]; notify: (message: string) => void }) {
  const [inboxText, setInboxText] = useState('')
  const [showCapture, setShowCapture] = useState(false)

  function finish(task: Task) {
    setState(completeTask(state, task.id))
    notify('Tarefa concluída e plano atualizado')
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
        <PlanTimeline tasks={activeTasks} onReorder={reorder} onFinish={finish} onAdd={() => notify('Escolha uma tarefa para adicionar ao plano')} />
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
    <div className="task-time"><span>{task.time}</span><small>— {task.duration}</small></div>
    <div className="task-node" style={{ '--task-color': task.color } as React.CSSProperties} />
    <div className="task-card">
      <div>
        <small className="project-name" style={{ color: task.color }}>{task.project}</small>
        <h3>{task.title}</h3>
        <div className="task-meta"><span>{task.priority}</span>{task.dependency && <><span className="dot">•</span><span>{task.dependency}</span></>}</div>
      </div>
      <div className="task-card-actions">
        <DotsSixVertical className="drag-grip" size={16} />
        {first && <button className="primary-button" onClick={onFinish}><Check size={18} weight="bold" />Concluir</button>}
      </div>
    </div>
  </article>
}
