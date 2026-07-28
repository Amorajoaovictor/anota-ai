'use client'

import { CalendarBlank, CaretLeft, CaretRight, Clock, DotsSixVertical, Flag, Plus, Tray, X } from '@phosphor-icons/react'
import { useMemo, useState, type CSSProperties } from 'react'
import { dragHandleProps, useDropZone } from './dnd'
import { getMilestoneProgress, scopeMilestones, scopeTasks, type AppState, type Milestone, type Scope, type Task } from './domain'
import type { ProjectActions } from './lib/store'
import { formatDate, MilestoneBadges, slug } from './milestones'
import { buildRoadmapWeek, formatRoadmapWeekRange, groupMilestonesByRoadmapDay, groupTasksByRoadmapDay, type RoadmapDayWithTasks } from './roadmap'
import type { TaskCreateDefaults } from './taskCreate'

type RoadmapProps = {
  state: AppState
  scope: Scope
  actions: ProjectActions
  notify: (message: string) => void
  onOpen: (task: Task) => void
  onCreateTask: (defaults?: TaskCreateDefaults) => void
}

export function RoadmapView({ state, scope, actions, notify, onOpen, onCreateTask }: RoadmapProps) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const tasks = useMemo(() => scopeTasks(state, scope), [state, scope])
  const milestones = useMemo(() => scopeMilestones(state, scope), [state, scope])
  const days = useMemo(() => buildRoadmapWeek(anchor), [anchor])
  const roadmap = useMemo(() => groupTasksByRoadmapDay(tasks, days), [days, tasks])
  const milestoneDays = useMemo(() => groupMilestonesByRoadmapDay(milestones, days), [days, milestones])
  const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId)

  function moveWeek(offset: number) {
    setAnchor((current) => {
      const next = new Date(current)
      next.setDate(current.getDate() + offset * 7)
      return next
    })
  }

  function schedule(taskId: string, due: string) {
    void actions.updateTask(taskId, { due })
  }

  return <div className="view-panel roadmap-board">
    <div className="roadmap-toolbar">
      <div className="roadmap-week-nav">
        <button aria-label="Semana anterior" onClick={() => moveWeek(-1)}><CaretLeft size={17} /></button>
        <div><CalendarBlank size={17} /><strong>{formatRoadmapWeekRange(days)}</strong></div>
        <button aria-label="Próxima semana" onClick={() => moveWeek(1)}><CaretRight size={17} /></button>
        <button className="roadmap-today" onClick={() => setAnchor(new Date())}>Hoje</button>
      </div>
      <div className="roadmap-capacity">
        <strong>Semana</strong>
        <span>arraste um card para outro dia para replanejar</span>
      </div>
    </div>

    {selectedMilestone && <MilestoneSummary milestone={selectedMilestone} tasks={tasks} onClose={() => setSelectedMilestoneId(null)} onOpen={onOpen} />}

    <div className="roadmap-scroll">
      <div className="roadmap-week-grid">
        {roadmap.days.map((day) => <RoadmapDayColumn
          key={day.key}
          day={day}
          milestones={milestoneDays.find((item) => item.key === day.key)?.milestones ?? []}
          allMilestones={milestones}
          selectedMilestoneId={selectedMilestoneId}
          tasks={tasks}
          onSelectMilestone={setSelectedMilestoneId}
          onSchedule={schedule}
          onOpen={onOpen}
          // `day.key` é DD/MM, mesmo formato que o arraste grava em `due`.
          onCreate={() => onCreateTask({ due: day.key })}
        />)}
      </div>
    </div>

    <UnscheduledTray tasks={roadmap.unscheduled} milestones={milestones} onSchedule={schedule} onOpen={onOpen} />
  </div>
}

function RoadmapDayColumn({ day, milestones, allMilestones, selectedMilestoneId, tasks, onSelectMilestone, onSchedule, onOpen, onCreate }: {
  day: RoadmapDayWithTasks
  milestones: Milestone[]
  allMilestones: Milestone[]
  selectedMilestoneId: string | null
  tasks: Task[]
  onSelectMilestone: (id: string) => void
  onSchedule: (taskId: string, due: string) => void
  onOpen: (task: Task) => void
  onCreate: () => void
}) {
  const zone = useDropZone((item) => item.type === 'task' && item.from !== day.key, (item) => onSchedule(item.id, day.key))

  return <section className={`roadmap-day ${day.isToday ? 'today' : ''} ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`} {...zone.dropProps}>
    <header>
      <span>{day.weekday}</span>
      <strong>{day.day}</strong>
      <small>{day.month}</small>
      <em>{day.tasks.length}</em>
      <button className="column-add" aria-label={`Nova tarefa em ${day.key}`} onClick={onCreate}><Plus size={14} weight="bold" /></button>
    </header>
    {milestones.length > 0 && <div className="roadmap-milestones">{milestones.map((milestone) =>
      <RoadmapMilestone key={milestone.id} milestone={milestone} tasks={tasks} active={milestone.id === selectedMilestoneId} onSelect={() => onSelectMilestone(milestone.id)} />)}</div>}
    <div className="roadmap-day-list">
      {day.tasks.map((task) => <RoadmapCard key={task.id} task={task} from={day.key} milestones={allMilestones} onOpen={() => onOpen(task)} />)}
      {!day.tasks.length && <div className="roadmap-empty-day">{zone.active ? 'Soltar aqui' : 'Sem demandas'}</div>}
    </div>
  </section>
}

function UnscheduledTray({ tasks, milestones, onSchedule, onOpen }: {
  tasks: Task[]
  milestones: Milestone[]
  onSchedule: (taskId: string, due: string) => void
  onOpen: (task: Task) => void
}) {
  const zone = useDropZone((item) => item.type === 'task' && item.from !== 'unscheduled', (item) => onSchedule(item.id, ''))
  if (!tasks.length && !zone.active) return null

  return <section className={`roadmap-unscheduled ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`} {...zone.dropProps}>
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

function RoadmapCard({ task, from, milestones, onOpen, compact = false }: { task: Task; from: string; milestones: Milestone[]; onOpen: () => void; compact?: boolean }) {
  return <div
    className={`roadmap-demand ${compact ? 'compact' : ''}`}
    style={{ '--project-color': task.color } as CSSProperties}
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
    {...dragHandleProps({ type: 'task', id: task.id, from })}
  >
    <span className="roadmap-demand-project"><i />{task.project}<b>{task.priority}</b><DotsSixVertical className="drag-grip" size={13} /></span>
    <strong>{task.title}</strong>
    <MilestoneBadges milestoneIds={task.milestoneIds} milestones={milestones} />
    <small>{task.module ?? 'Geral'} · {task.status}</small>
    <span className="roadmap-demand-time"><Clock size={13} />{task.due ?? 'Sem prazo'}<em>{task.complexity ?? 'A estimar'}</em></span>
  </div>
}
