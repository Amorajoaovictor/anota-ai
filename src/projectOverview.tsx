'use client'

import { X } from '@phosphor-icons/react'
import { groupTasksByStatus, scopeMilestones, scopeProject, scopeTasks, taskStatuses, type AppState, type Scope, type Task } from './domain'
import { Heading } from './heading'
import { EmptyState, PriorityPill, StatusPill, TagChips } from './ui'

export function ProjectOverview({ state, scope, onOpenTask }: { state: AppState; scope: Scope; onOpenTask: (task: Task) => void }) {
  const project = scopeProject(state, scope)
  const tasks = scopeTasks(state, scope)
  const milestones = scopeMilestones(state, scope)
  if (!project) return <EmptyState size="page" icon={<X size={40} />} title="Projeto não encontrado" description="Ele pode ter sido removido." />

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
          {taskStatuses.map((status) => <li key={status}>
            <StatusPill status={status} />
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
