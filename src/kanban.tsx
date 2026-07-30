'use client'

import { CalendarBlank, CaretDown, DotsSixVertical, Flag, Kanban, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { filterTasksByMilestone, groupTasksByStatus, scopeMilestones, scopeProject, scopeTasks, taskStatuses, type AppState, type MilestoneFilter, type Scope, type Task, type TaskStatus } from './domain'
import { statusClass } from './format'
import { Heading } from './heading'
import type { ProjectActions } from './lib/store'
import { MilestoneBadges } from './milestones'
import type { TaskCreateDefaults } from './taskCreate'
import { PriorityPill } from './ui'

const wipLimit: Partial<Record<TaskStatus, number>> = { 'Em andamento': 3 }

export function KanbanView({ state, scope, actions, onOpen, onStatusChange, onCreateTask }: { state: AppState; scope: Scope; actions: ProjectActions; onOpen: (task: Task) => void; onStatusChange: (task: Task, status: TaskStatus) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
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
    <Heading level="section" title="Kanban" icon={<Kanban size={34} />} subtitle={scoped ? `Fluxo de ${scoped.name}. Arraste os cards entre colunas para mudar o status.` : 'Arraste os cards entre colunas para mudar o status.'} />
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
      {taskStatuses.map((status) => <KanbanColumn
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
          {taskStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <CaretDown size={11} />
      </label>
    </div>
  </article>
}
