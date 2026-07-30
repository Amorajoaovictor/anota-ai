'use client'

import { CalendarBlank, Plus, Target } from '@phosphor-icons/react'
import { scopeProject, scopeTasks, type AppState, type Scope, type Task } from './domain'
import { compareDue } from './format'
import { Heading } from './heading'
import type { TaskCreateDefaults } from './taskCreate'
import { Button, PriorityPill } from './ui'

export function DeadlinesView({ state, scope, onOpen, onCreateTask }: { state: AppState; scope: Scope; onOpen: (task: Task) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const scoped = scopeProject(state, scope)
  const inScope = scopeTasks(state, scope)
  const scheduled = inScope.filter((task) => task.due && task.status !== 'Concluída')
  const withoutDue = inScope.filter((task) => !task.due && task.status !== 'Concluída')
  const byDay = [...new Set(scheduled.map((task) => task.due as string))].sort(compareDue)

  return <>
    <Heading
      level="section"
      title="Prazos"
      icon={<CalendarBlank size={34} />}
      subtitle={scoped ? `Datas de ${scoped.name}, agrupadas por dia. Nada é adiado automaticamente.` : 'Tudo que tem data, agrupado por dia. Nada é adiado automaticamente.'}
      action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => onCreateTask()}>Nova tarefa</Button>}
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
