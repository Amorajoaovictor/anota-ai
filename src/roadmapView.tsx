'use client'

import { ArrowLeft, ArrowRight, CalendarBlank, CaretDown, CheckCircle, Circle, DotsSixVertical, Flag, Hand, Plus, Prohibit, Tray, X } from '@phosphor-icons/react'
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { dragHandleProps, useDropZone } from './dnd'
import { getMilestoneProgress, scopeMilestones, scopeTasks, type AppState, type Milestone, type Scope, type Task } from './domain'
import type { ProjectActions } from './lib/store'
import { formatDate, slug } from './format'
import { MilestoneBadges } from './milestones'
import { TouchDragHandle, useTouchDropZone } from './touchDrag'
import { buildRoadmapTimeline, groupRoadmapTimeline, shiftRoadmapDate, type RoadmapColumn, type RoadmapScale } from './roadmap'
import './roadmap.css'
import type { TaskCreateDefaults } from './taskCreate'
import type { Notify } from './ui'

type RoadmapProps = {
  state: AppState
  scope: Scope
  actions: ProjectActions
  notify: Notify
  onOpen: (task: Task) => void
  onCreateTask: (defaults?: TaskCreateDefaults) => void
}

const WINDOW_COLUMNS = 49
const WINDOW_CENTER = 20

export function RoadmapView({ state, scope, actions, notify, onOpen, onCreateTask }: RoadmapProps) {
  const [scale, setScale] = useState<RoadmapScale>('days')
  const [projectId, setProjectId] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [focus, setFocus] = useState(() => shiftRoadmapDate(new Date(), -4))
  const [start, setStart] = useState(() => shiftRoadmapDate(new Date(), -24))
  const [viewportWidth, setViewportWidth] = useState(1100)
  const [labelWidth, setLabelWidth] = useState(180)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef<number | null>(WINDOW_CENTER * 144)
  const initialized = useRef(false)
  const pan = useRef<{ x: number; left: number } | null>(null)
  const step = scale === 'days' ? 1 : 7
  const width = scale === 'days' ? 144 : 240
  const projects = state.projects.filter(project => scope.type === 'global' || project.id === scope.projectId)
  const effectiveScope: Scope = scope.type === 'global' && projectId ? { type: 'project', projectId } : scope
  const tasks = useMemo(() => scopeTasks(state, effectiveScope), [state, effectiveScope.type, effectiveScope.type === 'project' ? effectiveScope.projectId : ''])
  const milestones = useMemo(() => scopeMilestones(state, effectiveScope), [state, effectiveScope.type, effectiveScope.type === 'project' ? effectiveScope.projectId : ''])
  const columns = useMemo(() => buildRoadmapTimeline(start, scale, WINDOW_COLUMNS), [start, scale])
  const roadmap = useMemo(() => groupRoadmapTimeline(tasks, milestones, columns), [tasks, milestones, columns])
  const rows = useMemo(() => {
    const names = new Set([...tasks.map(task => task.project), ...milestones.map(milestone => milestone.project)])
    projects.filter(project => effectiveScope.type === 'global' || project.id === effectiveScope.projectId).forEach(project => names.add(project.name))
    return [...names].map(name => ({ name, color: projects.find(project => project.name === name)?.color ?? tasks.find(task => task.project === name)?.color ?? '#68d7a7', count: tasks.filter(task => task.project === name).length }))
  }, [tasks, milestones, state.projects, scope, projectId])
  const selectedMilestone = milestones.find(milestone => milestone.id === selectedMilestoneId)
  const visibleCount = Math.max(1, Math.ceil((viewportWidth - labelWidth) / width))
  const visible = buildRoadmapTimeline(focus, scale, visibleCount)
  const range = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
  const firstLabel = range.format(visible[0].date)
  const lastLabel = range.format(visible[visible.length - 1].endDate)

  useLayoutEffect(() => {
    if (scroll.current && !initialized.current) {
      initialized.current = true
      const labels = scroll.current.querySelector('.roadmap-project-corner')?.getBoundingClientRect().width ?? 180
      const offset = Math.floor(Math.max(1, Math.floor((scroll.current.clientWidth - labels) / width)) / 2)
      pendingScroll.current = (24 - offset) * width
      setFocus(shiftRoadmapDate(new Date(), -offset))
    }
    if (scroll.current && pendingScroll.current !== null) {
      scroll.current.scrollLeft = pendingScroll.current
      pendingScroll.current = null
    }
  }, [start, scale])

  useLayoutEffect(() => {
    const element = scroll.current
    if (!element) return
    function measure() {
      setViewportWidth(element!.clientWidth || 1100)
      setLabelWidth(element!.querySelector('.roadmap-project-corner')?.getBoundingClientRect().width ?? 180)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function goToday() {
    const offset = Math.floor(Math.max(1, Math.floor((viewportWidth - labelWidth) / width)) / 2)
    navigate(shiftRoadmapDate(new Date(), -offset * step))
  }

  function changeScale(nextScale: RoadmapScale) {
    if (nextScale === scale) return
    const currentCount = Math.max(1, Math.floor((viewportWidth - labelWidth) / width))
    const center = shiftRoadmapDate(focus, Math.floor(currentCount / 2) * step)
    const nextWidth = nextScale === 'days' ? 144 : 240
    const nextStep = nextScale === 'days' ? 1 : 7
    const nextCount = Math.max(1, Math.floor((viewportWidth - labelWidth) / nextWidth))
    navigate(shiftRoadmapDate(center, -Math.floor(nextCount / 2) * nextStep), nextScale)
  }

  function navigate(date: Date, nextScale = scale) {
    const nextStep = nextScale === 'days' ? 1 : 7
    const nextWidth = nextScale === 'days' ? 144 : 240
    const aligned = buildRoadmapTimeline(date, nextScale, 1)[0].date
    pendingScroll.current = WINDOW_CENTER * nextWidth
    setFocus(aligned)
    setStart(shiftRoadmapDate(aligned, -WINDOW_CENTER * nextStep))
    setScale(nextScale)
  }

  function explore() {
    const element = scroll.current
    if (!element || pendingScroll.current !== null) return
    const index = Math.floor(element.scrollLeft / width)
    const nextFocus = shiftRoadmapDate(columns[0].date, index * step)
    setFocus(current => current.getTime() === nextFocus.getTime() ? current : nextFocus)
    // Rebase a bounded window, keeping its pixel offset and visible dates intact.
    const shift = index < 5 ? -15 : index > 32 ? 15 : 0
    if (shift) {
      pendingScroll.current = element.scrollLeft - shift * width
      if (pan.current) pan.current.left -= shift * width
      setStart(shiftRoadmapDate(columns[0].date, shift * step))
    }
  }

  function schedule(taskId: string, due: string) {
    void actions.updateTask(taskId, { due }).catch((error: unknown) => {
      console.error('roadmap.task.schedule.failed', { operation: 'updateTask', taskId, due, endpoint: `/api/tasks/${taskId}`, error, stack: error instanceof Error ? error.stack : undefined, cause: error instanceof Error ? error.cause : undefined })
      notify('Não foi possível salvar a data da tarefa.', 'error')
    })
  }

  return <div className="view-panel roadmap-board roadmap-timeline" data-touch-drag-root>
    <div className="roadmap-toolbar">
      <div className="roadmap-controls">
        <label className="roadmap-project-filter"><CalendarBlank size={18} /><select aria-label="Filtrar projetos" value={scope.type === 'project' ? scope.projectId : projectId} disabled={scope.type === 'project'} onChange={event => setProjectId(event.target.value)}>
          {scope.type === 'global' && <option value="">Todos os projetos</option>}
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
        <button className="roadmap-today" onClick={goToday}>Hoje</button>
        <strong className="roadmap-visible-range" aria-live="polite">{firstLabel === lastLabel ? firstLabel : `${firstLabel} — ${lastLabel}`}</strong>
      </div>
      <div className="roadmap-scale" aria-label="Escala da timeline">
        <button aria-pressed={scale === 'days'} onClick={() => changeScale('days')}>Dias</button>
        <button aria-pressed={scale === 'weeks'} onClick={() => changeScale('weeks')}>Semanas</button>
      </div>
    </div>
    <p className="roadmap-touch-instructions">Arraste pela alça do card para mudar a data.</p>
    {selectedMilestone && <MilestoneSummary milestone={selectedMilestone} tasks={tasks} onClose={() => setSelectedMilestoneId(null)} onOpen={onOpen} />}
    <div className="roadmap-scroll" data-touch-drag-scroll style={{ '--roadmap-viewport': `${viewportWidth}px` } as CSSProperties} ref={scroll} role="region" aria-label="Timeline de tarefas. Use as setas para explorar e Home para voltar a hoje." tabIndex={0} onScroll={explore}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigate(shiftRoadmapDate(focus, (event.key === 'ArrowLeft' ? -1 : 1) * step)) }
        if (event.key === 'Home') { event.preventDefault(); goToday() }
      }}
      onPointerDown={event => {
        if (event.button !== 0 || event.pointerType === 'touch' || (event.target as HTMLElement).closest('button, select, [draggable="true"]')) return
        pan.current = { x: event.clientX, left: event.currentTarget.scrollLeft }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.currentTarget.classList.add('panning')
      }}
      onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.left + pan.current.x - event.clientX }}
      onPointerUp={event => { pan.current = null; event.currentTarget.classList.remove('panning'); if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={event => { pan.current = null; event.currentTarget.classList.remove('panning') }}>
      <div className="roadmap-timeline-grid" style={{ '--column-width': `${width}px`, gridTemplateColumns: `180px repeat(${WINDOW_COLUMNS}, ${width}px)` } as CSSProperties}>
        <div className="roadmap-project-corner">Projetos</div>
        {columns.map(column => <header key={column.key} className={`roadmap-date ${column.isToday ? 'today' : ''}`}>
          <strong>{column.day.toString().padStart(2, '0')} {column.month.toLowerCase()}{scale === 'weeks' && <small> — {column.endDate.getDate().toString().padStart(2, '0')} {column.endDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>}</strong>
          {column.isToday && <em>Hoje</em>}<span>{scale === 'days' ? column.weekday : 'SEMANA'}</span>
        </header>)}
        {rows.map(row => <RoadmapProjectRow key={row.name} name={row.name} color={row.color} count={row.count} collapsed={collapsed.includes(row.name)}
          onToggle={() => setCollapsed(current => current.includes(row.name) ? current.filter(name => name !== row.name) : [...current, row.name])}
          columns={roadmap.columns} scale={scale} milestones={milestones} tasks={tasks} selectedMilestoneId={selectedMilestoneId} onSelectMilestone={setSelectedMilestoneId} onSchedule={schedule} onOpen={onOpen} onCreateTask={onCreateTask} />)}
      </div>
      {!rows.length && <p className="roadmap-no-projects">Nenhum projeto neste escopo.</p>}
    </div>
    <div className="roadmap-pan-hint"><button aria-label="Recuar timeline" onClick={() => navigate(shiftRoadmapDate(focus, -step * visibleCount))}><ArrowLeft size={20} /></button><span /><Hand size={21} /><p>Arraste para os lados</p><span /><button aria-label="Avançar timeline" onClick={() => navigate(shiftRoadmapDate(focus, step * visibleCount))}><ArrowRight size={20} /></button></div>
    <UnscheduledTray tasks={roadmap.unscheduled} milestones={milestones} onSchedule={schedule} onOpen={onOpen} />
  </div>
}

type TimelineData = ReturnType<typeof groupRoadmapTimeline>['columns']
function RoadmapProjectRow({ name, color, count, collapsed, onToggle, columns, ...props }: {
  name: string; color: string; count: number; collapsed: boolean; onToggle: () => void; columns: TimelineData
} & Omit<React.ComponentProps<typeof RoadmapCell>, 'column' | 'project'>) {
  return <div className="roadmap-project-row">
    <button className="roadmap-project-label" aria-expanded={!collapsed} onClick={onToggle} style={{ '--project-color': color } as CSSProperties}><Circle size={15} weight="fill" /><strong>{name}</strong><small>{count} {count === 1 ? 'tarefa' : 'tarefas'}</small><CaretDown size={16} /></button>
    {columns.map(column => collapsed ? <div key={column.key} className={`roadmap-cell collapsed ${column.isToday ? 'today' : ''}`} /> : <RoadmapCell key={column.key} column={column} project={name} {...props} />)}
  </div>
}

function RoadmapCell({ column, project, scale, milestones, tasks, selectedMilestoneId, onSelectMilestone, onSchedule, onOpen, onCreateTask }: {
  column: RoadmapColumn & { tasks: Task[]; milestones: Milestone[] }; project: string; scale: RoadmapScale; milestones: Milestone[]; tasks: Task[]; selectedMilestoneId: string | null
  onSelectMilestone: (id: string) => void; onSchedule: (taskId: string, due: string) => void; onOpen: (task: Task) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void
}) {
  const accept: Parameters<typeof useDropZone>[0] = item => {
    const task = tasks.find(task => task.id === item.id)
    return item.type === 'task' && task?.project === project && !(task.due && task.due >= column.key && task.due <= column.endKey)
  }
  const drop: Parameters<typeof useDropZone>[1] = item => onSchedule(item.id, column.key)
  const zone = useDropZone(accept, drop)
  const touch = useTouchDropZone(accept, drop)
  return <section ref={touch.ref} data-testid={`roadmap-cell-${project}-${column.key}`} aria-label={`${project}: ${column.key}${scale === 'weeks' ? ` a ${column.endKey}; soltar define ${column.key}` : ''}`} className={`roadmap-cell ${column.isToday ? 'today' : ''} ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''} ${touch.over ? 'touch-drop-over' : ''}`} {...zone.dropProps}>
    {column.tasks.filter(task => task.project === project).map(task => <RoadmapCard key={task.id} task={task} from={task.due!} milestones={milestones} onOpen={() => onOpen(task)} showDate={scale === 'weeks'} />)}
    {column.milestones.filter(milestone => milestone.project === project).map(milestone => <RoadmapMilestone key={milestone.id} milestone={milestone} tasks={tasks} active={selectedMilestoneId === milestone.id} onSelect={() => onSelectMilestone(milestone.id)} />)}
    <button className="roadmap-cell-add" aria-label={`Nova tarefa em ${project} em ${column.key}`} onClick={() => onCreateTask({ project, due: column.key })}><Plus size={14} /></button>
  </section>
}

function UnscheduledTray({ tasks, milestones, onSchedule, onOpen }: {
  tasks: Task[]
  milestones: Milestone[]
  onSchedule: (taskId: string, due: string) => void
  onOpen: (task: Task) => void
}) {
  const accept: Parameters<typeof useDropZone>[0] = item => item.type === 'task' && item.from !== 'unscheduled'
  const drop: Parameters<typeof useDropZone>[1] = item => onSchedule(item.id, '')
  const zone = useDropZone(accept, drop)
  const touch = useTouchDropZone(accept, drop)
  if (!tasks.length && !zone.active) return null

  return <section ref={touch.ref} className={`roadmap-unscheduled ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''} ${touch.over ? 'touch-drop-over' : ''}`} {...zone.dropProps}>
    <header><Tray size={18} /><div><strong>Sem data definida</strong><span>{tasks.length} demandas fora da timeline</span></div></header>
    <div>
      {tasks.map((task) => <RoadmapCard key={task.id} task={task} from="unscheduled" milestones={milestones} onOpen={() => onOpen(task)} compact />)}
      {!tasks.length && <div className="roadmap-empty-day">Soltar para remover a data</div>}
    </div>
  </section>
}

function RoadmapMilestone({ milestone, tasks, active, onSelect }: { milestone: Milestone; tasks: Task[]; active: boolean; onSelect: () => void }) {
  const progress = getMilestoneProgress(milestone, tasks)
  return <button className={`roadmap-milestone ${active ? 'active' : ''} ${slug(milestone.status)}`} style={{ '--milestone-color': milestone.color } as CSSProperties} onClick={onSelect}>
    <Flag size={13} weight="fill" /><span>{milestone.name}</span><b>{progress.percentage}%</b>
  </button>
}

function MilestoneSummary({ milestone, tasks, onClose, onOpen }: { milestone: Milestone; tasks: Task[]; onClose: () => void; onOpen: (task: Task) => void }) {
  const linked = tasks.filter((task) => task.milestoneIds?.includes(milestone.id))
  const progress = getMilestoneProgress(milestone, tasks)
  return <section className="roadmap-milestone-summary" style={{ '--milestone-color': milestone.color } as CSSProperties}>
    <Flag size={22} weight="fill" />
    <div><small>{milestone.project} · {milestone.status}</small><strong>{milestone.name}</strong><span>{milestone.description || 'Sem resultado esperado descrito.'}</span></div>
    <div className="roadmap-milestone-progress"><strong>{progress.percentage}%</strong><span>{progress.completed}/{progress.total} tasks · {formatDate(milestone.targetDate)}</span></div>
    <div className="roadmap-milestone-tasks">{linked.map((task) => <button key={task.id} onClick={() => onOpen(task)}>{task.title}</button>)}</div>
    <button className="milestone-summary-close" aria-label="Fechar resumo do marco" onClick={onClose}><X size={16} /></button>
  </section>
}

function RoadmapCard({ task, from, milestones, onOpen, compact = false, showDate = false }: { task: Task; from: string; milestones: Milestone[]; onOpen: () => void; compact?: boolean; showDate?: boolean }) {
  const StatusIcon = task.status === 'Concluída' ? CheckCircle : task.status === 'Bloqueada' || task.status === 'Cancelada' ? Prohibit : Circle
  return <div className={`roadmap-demand ${compact ? 'compact' : ''} ${slug(task.status)}`} style={{ '--project-color': task.color } as CSSProperties}
    role="button" aria-label={task.title} tabIndex={0} onClick={onOpen}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
    {...dragHandleProps({ type: 'task', id: task.id, from })}>
    <StatusIcon className="roadmap-status-icon" size={22} weight={task.status === 'Concluída' ? 'fill' : 'bold'} />
    <strong>{task.title}</strong>
    <small className="roadmap-status">{task.status}</small>
    <span className="roadmap-priority" data-priority={task.priority}><Flag size={13} weight="fill" />{task.priority}{showDate && <time dateTime={task.due}>{formatDate(task.due!)}</time>}</span>
    {compact && <span className="roadmap-demand-project"><Circle size={13} weight="fill" />{task.project}<DotsSixVertical className="drag-grip" size={15} /></span>}
    {!!task.milestoneIds?.length && <MilestoneBadges milestoneIds={task.milestoneIds} milestones={milestones} />}
    <TouchDragHandle item={{ type: 'task', id: task.id, from }} label={task.title} />
  </div>
}
