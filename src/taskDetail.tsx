'use client'

import { useEffect, useState } from 'react'
import { complexities, priorities, projectTags, taskStatuses, type AppState, type Complexity, type Priority, type Task, type TaskStatus } from './domain'
import { formatHistoryDate } from './format'
import type { ProjectActions, TaskHistoryEntry } from './lib/store'
import type { TaskPatch } from './lib/mapping'
import { TaskMilestoneSelector } from './milestones'
import { Button, Modal, PriorityPill } from './ui'

const historyLabels: Record<string, string> = {
  'task.created': 'Card criado',
  'task.updated': 'Card editado',
  'task.moved': 'Status alterado',
}

export function TaskDetail({ task, state, loadHistory, onClose, onStatusChange, onMilestonesChange, onTagsChange, onTaskUpdate }: { task: Task; state: AppState; loadHistory: ProjectActions['loadTaskHistory']; onClose: () => void; onStatusChange: (status: TaskStatus) => void; onMilestonesChange: (milestoneIds: string[]) => void; onTagsChange: (tagIds: string[]) => void; onTaskUpdate: (patch: TaskPatch) => void }) {
  const emptyDraft = {
    title: task.title,
    description: task.description ?? '',
    module: task.module ?? '',
    priority: task.priority,
    due: task.due ?? '',
    forecast: task.forecast ?? '',
    complexity: task.complexity ?? '' as Complexity | '',
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [history, setHistory] = useState<TaskHistoryEntry[] | null>(null)
  const patch = (value: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...value }))
  // Cards ainda não persistidos (criação otimista em voo) não têm trilha para ler.
  const dependencyOptions = state.tasks.filter((item) => item.project === task.project && item.id !== task.id)
  const availableTags = projectTags(state, task.project)

  useEffect(() => {
    let active = true
    setHistory(null)
    loadHistory(task.id).then((entries) => { if (active) setHistory(entries) }).catch(() => { if (active) setHistory([]) })
    return () => { active = false }
  }, [task.id, loadHistory])

  return <Modal
    variant="sheet"
    size="lg"
    accent={task.color}
    eyebrow={task.project}
    title={task.title}
    onClose={onClose}
    closeLabel="Fechar detalhe da tarefa"
    footer={editing
      ? <>
        <Button onClick={() => { setDraft(emptyDraft); setEditing(false) }}>Cancelar</Button>
        <Button variant="primary" onClick={() => { onTaskUpdate({ ...draft, complexity: draft.complexity || undefined }); setEditing(false) }}>Salvar card</Button>
      </>
      : <Button variant="primary" onClick={() => setEditing(true)}>Editar card</Button>}
  >
    {editing
      ? <div className="ui-form">
        <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label className="ui-form-wide">Descrição<textarea value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="O que precisa ser feito, e por quê." /></label>
        <label>Módulo<input value={draft.module} onChange={(event) => patch({ module: event.target.value })} /></label>
        <label>Prioridade<select value={draft.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prazo confirmado<input value={draft.due} onChange={(event) => patch({ due: event.target.value })} placeholder="DD/MM" /></label>
        <label>Previsão de entrega<input value={draft.forecast} onChange={(event) => patch({ forecast: event.target.value })} placeholder="DD/MM" /></label>
        <label>Complexidade<select value={draft.complexity} onChange={(event) => patch({ complexity: event.target.value as Complexity | '' })}>
          <option value="">A estimar</option>
          {complexities.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <p className="ui-form-hint ui-form-wide">Prazo é compromisso; previsão é estimativa. Previsão vencida vira alerta, não atraso.</p>
      </div>
      : <>
        <div className="detail-facts">
          <label className="detail-status">STATUS
            <select value={task.status} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          </label>
          <div><small>MÓDULO</small><strong>{task.module ?? 'Geral'}</strong></div>
          <div><small>TIPO</small><strong>{task.kind ?? 'Tarefa'}</strong></div>
          <div><small>PRIORIDADE</small><strong><PriorityPill priority={task.priority} /></strong></div>
          <div><small>COMPLEXIDADE</small><strong>{task.complexity ?? 'A estimar'}</strong></div>
          <div><small>PRAZO</small><strong>{task.due ?? 'Sem prazo'}</strong></div>
          <div><small>PREVISÃO</small><strong>{task.forecast ?? 'A estimar'}</strong></div>
        </div>
        {task.description && <section className="detail-block">
          <h3>Descrição</h3>
          <p className="detail-description">{task.description}</p>
        </section>}
        <section className="detail-block">
          <h3>Etiquetas</h3>
          {availableTags.length
            ? <div className="tag-selector">{availableTags.map((tag) => {
              const linked = task.tagIds?.includes(tag.id) ?? false
              return <label key={tag.id} className={`tag-option ${linked ? 'active' : ''}`} style={{ '--tag-color': tag.color } as React.CSSProperties}>
                <input
                  type="checkbox"
                  aria-label={`Etiqueta ${tag.name}`}
                  checked={linked}
                  onChange={() => onTagsChange(linked
                    ? (task.tagIds ?? []).filter((id) => id !== tag.id)
                    : [...(task.tagIds ?? []), tag.id])}
                />
                <i />
                <span>{tag.name}</span>
              </label>
            })}</div>
            : <p>Nenhuma etiqueta cadastrada neste projeto. Crie na edição do projeto.</p>}
        </section>
        <section className="detail-block">
          <h3>Marcos</h3>
          <TaskMilestoneSelector task={task} milestones={state.milestones} onChange={onMilestonesChange} />
        </section>
        <section className="detail-block">
          <h3>Depende de</h3>
          {dependencyOptions.length
            ? <div className="dependency-options">{dependencyOptions.map((item) => {
              const linked = task.dependsOnIds?.includes(item.id) ?? false
              return <label key={item.id} className={`dependency-option ${linked ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  aria-label={`Depende de ${item.title}`}
                  checked={linked}
                  onChange={() => onTaskUpdate({
                    dependsOnIds: linked
                      ? (task.dependsOnIds ?? []).filter((id) => id !== item.id)
                      : [...(task.dependsOnIds ?? []), item.id],
                  })}
                />
                <span>{item.title}</span>
                <small>{item.status}</small>
              </label>
            })}</div>
            : <p>Nenhum outro card neste projeto para depender.</p>}
        </section>
        <section className="detail-block">
          <h3>Histórico</h3>
          {history === null && <p>Carregando histórico...</p>}
          {history?.length === 0 && <p>Nenhum evento registrado para este card.</p>}
          {history?.map((entry) => <p key={entry.id}>
            {historyLabels[entry.action] ?? entry.action} · {formatHistoryDate(entry.createdAt)}
          </p>)}
        </section>
      </>}
  </Modal>
}
