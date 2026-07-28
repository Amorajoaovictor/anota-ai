'use client'

import { MagicWand } from '@phosphor-icons/react'
import { useState } from 'react'
import { entryKinds, priorities, projectTags, scopeMilestones, scopeProject, scopeProjects, suggestTaskFields, taskStatuses, type AppState, type EntryKind, type Priority, type Scope, type TaskStatus } from './domain'
import { TaskMilestoneSelector } from './milestones'
import { Modal } from './ui'

/**
 * Pré-preenchimento vindo da tela que abriu a criação: coluna do Kanban define
 * status, dia do roadmap define prazo, filtro de marco vincula o marco.
 */
export type TaskCreateDefaults = {
  project?: string
  status?: TaskStatus
  due?: string
  module?: string
  milestoneIds?: string[]
}

export type TaskCreateInput = {
  title: string
  description: string
  project: string
  module: string
  kind: EntryKind
  status: TaskStatus
  priority: Priority
  due: string
  forecast: string
  milestoneIds: string[]
  tagIds: string[]
}

type Draft = TaskCreateInput
type Suggestion = NonNullable<ReturnType<typeof suggestTaskFields>>

export function TaskCreateDialog({ state, scope, defaults, onClose, onCreate }: {
  state: AppState
  scope: Scope
  defaults: TaskCreateDefaults
  onClose: () => void
  onCreate: (input: TaskCreateInput) => void
}) {
  const scoped = scopeProject(state, scope)
  const available = scopeProjects(state, scope)
  const [draft, setDraft] = useState<Draft>({
    title: '',
    description: '',
    project: defaults.project ?? scoped?.name ?? available[0]?.name ?? '',
    module: defaults.module ?? '',
    kind: 'Tarefa',
    status: defaults.status ?? 'Backlog',
    priority: 'P3',
    due: defaults.due ?? '',
    forecast: '',
    milestoneIds: defaults.milestoneIds ?? [],
    tagIds: [],
  })
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [beforeSuggestion, setBeforeSuggestion] = useState<Draft | null>(null)
  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }))
  const milestones = scopeMilestones(state, scope)
  const tags = projectTags(state, draft.project)
  const ready = Boolean(draft.title.trim() && draft.project)

  function changeProject(project: string) {
    // Marco e etiqueta pertencem a um projeto; trocar o projeto invalida a seleção.
    patch({ project, milestoneIds: [], tagIds: [] })
  }

  /** Preenche só o que ainda está no default — nunca sobrescreve o que o usuário digitou. */
  function suggest() {
    const next = suggestTaskFields(state, { title: draft.title, project: draft.project })
    if (!next) return
    setBeforeSuggestion(draft)
    setSuggestion(next)
    patch({
      module: draft.module.trim() || next.module,
      kind: draft.kind === 'Tarefa' ? next.kind : draft.kind,
      priority: draft.priority === 'P3' ? next.priority : draft.priority,
      forecast: draft.forecast.trim() || next.forecast,
    })
  }

  function toggleTag(tagId: string) {
    patch({ tagIds: draft.tagIds.includes(tagId) ? draft.tagIds.filter((id) => id !== tagId) : [...draft.tagIds, tagId] })
  }

  function undoSuggestion() {
    if (beforeSuggestion) setDraft(beforeSuggestion)
    setBeforeSuggestion(null)
    setSuggestion(null)
  }

  return <Modal
    title="Nova tarefa"
    eyebrow="CARD"
    description="Só título e projeto são obrigatórios. O resto pode ser sugerido pela IA ou ajustado depois."
    onClose={onClose}
    footer={<>
      <button className="ghost-button ui-suggest" disabled={!ready} onClick={suggest}><MagicWand size={17} />Sugerir com IA</button>
      <button className="ghost-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={!ready} onClick={() => onCreate(draft)}>Criar tarefa</button>
    </>}
  >
    <div className="ui-form">
      <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="O que precisa ser feito?" /></label>
      <label>Projeto{scoped
        ? <input value={scoped.name} readOnly aria-readonly="true" />
        : <select value={draft.project} onChange={(event) => changeProject(event.target.value)}>
          <option value="">Selecione</option>
          {available.map((item) => <option key={item.id}>{item.name}</option>)}
        </select>}</label>
      <label>Status<select value={draft.status} onChange={(event) => patch({ status: event.target.value as TaskStatus })}>{taskStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Módulo<input value={draft.module} onChange={(event) => patch({ module: event.target.value })} placeholder="Geral" /></label>
      <label>Tipo<select value={draft.kind} onChange={(event) => patch({ kind: event.target.value as EntryKind })}>{entryKinds.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Prioridade<select value={draft.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Prazo confirmado<input value={draft.due} onChange={(event) => patch({ due: event.target.value })} placeholder="DD/MM" /></label>
      <label>Previsão de entrega<input value={draft.forecast} onChange={(event) => patch({ forecast: event.target.value })} placeholder="DD/MM" /></label>
      <label className="ui-form-wide">Descrição<textarea value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Contexto, passos para reproduzir, links..." /></label>
    </div>

    {suggestion && <p className="ui-suggestion">
      <MagicWand size={15} />
      <span>IA sugeriu <b>{suggestion.kind}</b> · <b>{suggestion.priority}</b> · <b>{suggestion.module}</b> · previsão <b>{suggestion.forecast}</b> — confiança {suggestion.confidence}%</span>
      <button onClick={undoSuggestion}>desfazer</button>
    </p>}

    <section className="detail-block">
      <h3>Etiquetas</h3>
      {tags.length
        ? <div className="tag-selector">{tags.map((tag) => <label
          key={tag.id}
          className={`tag-option ${draft.tagIds.includes(tag.id) ? 'active' : ''}`}
          style={{ '--tag-color': tag.color } as React.CSSProperties}
        >
          <input type="checkbox" checked={draft.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
          <i />
          <span>{tag.name}</span>
        </label>)}</div>
        : <p>Nenhuma etiqueta cadastrada neste projeto.</p>}
    </section>

    <section className="detail-block">
      <h3>Marcos</h3>
      <TaskMilestoneSelector
        task={{ project: draft.project, milestoneIds: draft.milestoneIds }}
        milestones={milestones}
        onChange={(milestoneIds) => patch({ milestoneIds })}
      />
    </section>
  </Modal>
}
