'use client'

import { MapTrifold, X } from '@phosphor-icons/react'
import { ContextReviewQueue, SmartInboxView } from './contextFlow'
import { type AppState, type Scope, type Task, type TaskStatus } from './domain'
import { DeadlinesView } from './deadlines'
import { Heading } from './heading'
import { KanbanView } from './kanban'
import type { ProjectActions } from './lib/store'
import type { TaskPatch } from './lib/mapping'
import { IntegrationsView } from './integrations'
import { MilestonesView } from './milestones'
import { NotesView } from './notes'
import { ContextView } from './projectContext'
import { ProjectOverview } from './projectOverview'
import { ProjectsView } from './projects'
import { RoadmapView } from './roadmapView'
import { SpreadsheetView } from './spreadsheet'
import { TaskDetail } from './taskDetail'
import type { TaskCreateDefaults } from './taskCreate'
import { EmptyState, Button, type Notify } from './ui'

export type Phase1Section = 'Projetos' | 'Planilha' | 'Kanban' | 'Marcos' | 'Roadmap' | 'Prazos' | 'Notas' | 'Caixa de entrada' | 'Revisão IA' | 'Integrações'

/** Seções que existem dentro de um projeto. Ver `arquitetura-navegacao.md`. */
export type ProjectSection = 'Visão geral' | 'Planilha' | 'Kanban' | 'Marcos' | 'Roadmap' | 'Prazos' | 'Notas' | 'Contexto'

export const projectSections: ProjectSection[] = ['Visão geral', 'Planilha', 'Kanban', 'Marcos', 'Roadmap', 'Prazos', 'Notas', 'Contexto']

export function Phase1View({ section, scope, state, setState, actions, notify, onBack, onOpenProject, onCreateTask, openTaskId, onOpenTask, onCloseTask }: { section: Phase1Section | ProjectSection; scope: Scope; state: AppState; setState: (state: AppState) => void; actions: ProjectActions; notify: Notify; onBack: () => void; onOpenProject: (projectId: string) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void; openTaskId: string | null; onOpenTask: (task: Task) => void; onCloseTask: () => void }) {
  // O detalhe lê do estado, não de uma cópia: assim o rollback de uma escrita
  // falha aparece no painel aberto em vez de ficar mostrando o valor otimista.
  const selected = state.tasks.find((task) => task.id === openTaskId) ?? null
  const openTask = onOpenTask
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
      onClose={onCloseTask}
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
    if (section === 'Marcos') return <MilestonesView state={state} scope={scope} setState={setState} actions={actions} notify={notify} onOpenTask={openTask} />
    if (section === 'Roadmap') return <><Heading level="section" title="Roadmap" icon={<MapTrifold size={34} />} /><RoadmapView state={state} scope={scope} actions={actions} notify={notify} onOpen={openTask} onCreateTask={onCreateTask} /></>
    if (section === 'Prazos') return <DeadlinesView state={state} scope={scope} onOpen={openTask} onCreateTask={onCreateTask} />
    if (section === 'Notas') return <NotesView state={state} scope={scope} actions={actions} notify={notify} />
    if (section === 'Contexto') return <ContextView state={state} scope={scope} actions={actions} onOpenTask={openTask} />
    if (section === 'Caixa de entrada') return <SmartInboxView state={state} setState={setState} actions={actions} notify={notify} />
    if (section === 'Revisão IA') return <ContextReviewQueue state={state} setState={setState} actions={actions} notify={notify} />
    if (section === 'Integrações') return <IntegrationsView notify={notify} />
    return <EmptyView section={section} onBack={onBack} />
  }
}

function EmptyView({ section, onBack }: { section: string; onBack: () => void }) {
  return <EmptyState size="page" icon={<X size={40} />} title={`${section} em organização`} description="Essa visão será ligada aos mesmos dados do plano." action={<Button onClick={onBack}>Voltar para Hoje</Button>} />
}
