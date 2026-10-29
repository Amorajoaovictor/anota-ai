'use client'

import { Plus, Table } from '@phosphor-icons/react'
import { useState } from 'react'
import { filterTasks, scopeProject, scopeProjects, scopeTasks, taskDependencies, taskStatuses, taskTags, type AppState, type Scope, type Task, type TaskStatus } from './domain'
import { Heading } from './heading'
import type { TaskCreateDefaults } from './taskCreate'
import { Button, EmptyState, PriorityPill, StatusPill, TagChips } from './ui'

export function SpreadsheetView({ state, scope, onOpen, onCreateTask }: { state: AppState; scope: Scope; onOpen: (task: Task) => void; onCreateTask: (defaults?: TaskCreateDefaults) => void }) {
  const [query, setQuery] = useState(''); const [project, setProject] = useState(''); const [module, setModule] = useState(''); const [status, setStatus] = useState<TaskStatus | ''>('')
  const scoped = scopeProject(state, scope)
  const inScope = scopeTasks(state, scope)
  const tasks = filterTasks(inScope, { query, project: project || undefined, status: status || undefined })
    .filter((task) => !module || (task.module ?? 'Geral') === module)
  const active = scopeProjects(state, scope)
  // No escopo de projeto a coluna Projeto é redundante; Módulo assume o recorte.
  const modules = scoped ? [...new Set(inScope.map((task) => task.module ?? 'Geral'))].sort() : []

  return <>
    <Heading
      level="section"
      title="Planilha"
      icon={<Table size={34} />}
      subtitle={scoped ? `Cards de ${scoped.name} em formato tabular.` : 'Mesma base do Kanban e do roadmap, em formato tabular.'}
      action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => onCreateTask({ module: module || undefined })}>Nova tarefa</Button>}
    />

    <div className="view-panel table-panel">
      <div className="view-toolbar">
        <input aria-label="Buscar tarefas" placeholder="Buscar tarefas..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {scoped
          ? <select aria-label="Filtrar módulo" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="">Todos módulos</option>
            {modules.map((item) => <option key={item}>{item}</option>)}
          </select>
          : <select aria-label="Filtrar projeto" value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">Todos projetos</option>
            {active.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>}
        <select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | '')}>
          <option value="">Todos status</option>
          {taskStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="result-count">{tasks.length} registros</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Tarefa</th>{!scoped && <th>Projeto</th>}<th>Módulo</th><th>Tipo</th><th>Status</th><th>Prioridade</th><th>Etiquetas</th><th>Prazo</th><th>Previsão</th><th>Dependência</th></tr></thead>
          <tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onOpen(task)}>
            <td><strong>{task.title}</strong><small>{task.complexity ? `Complexidade ${task.complexity.toLocaleLowerCase()}` : 'Sem complexidade'}</small></td>
            {!scoped && <td><span className="table-project"><i style={{ background: task.color }} />{task.project}</span></td>}
            <td>{task.module ?? 'Geral'}</td>
            <td>{task.kind ?? 'Tarefa'}</td>
            <td><StatusPill status={task.status} /></td>
            <td><PriorityPill priority={task.priority} /></td>
            <td><TagChips tags={taskTags(state, task)} empty="—" /></td>
            <td>{task.due ?? 'Sem prazo'}</td>
            <td>{task.forecast ?? '—'}</td>
            <td>{taskDependencies(state.tasks, task).map((item) => item.title).join(', ') || '—'}</td>
          </tr>)}</tbody>
        </table>
        {!tasks.length && <EmptyState icon={<Table size={26} />} title="Nenhuma tarefa com esses filtros" description="Ajuste a busca ou crie uma nova tarefa." />}
      </div>
    </div>
  </>
}
