'use client'

import { Plus, Target, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { scopeContexts, scopeProject, scopeTasks, type AppState, type ProjectContextEntry, type Scope, type Task } from './domain'
import { Heading } from './heading'
import type { ProjectActions } from './lib/store'
import { Button, ConfirmDialog, EmptyState, Modal, TagChips } from './ui'

/**
 * Contexto do projeto (PRD 12.9). Nesta fase cobre o que a Fase 3 pede: registro
 * vinculado ao projeto e, opcionalmente, a um card. Pessoas, tecnologias,
 * repositórios, expiração e regras aprendidas entram na Fase 4.
 */
export function ContextView({ state, scope, actions, onOpenTask }: { state: AppState; scope: Scope; actions: ProjectActions; onOpenTask: (task: Task) => void }) {
  const project = scopeProject(state, scope)
  const contexts = scopeContexts(state, scope)
  const tasks = scopeTasks(state, scope)
  const emptyDraft = { title: '', content: '', taskId: '' }
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null)
  const [editing, setEditing] = useState<ProjectContextEntry | null>(null)
  const [removing, setRemoving] = useState<ProjectContextEntry | null>(null)
  if (!project) return <EmptyState size="page" icon={<X size={40} />} title="Projeto não encontrado" description="Ele pode ter sido removido." />

  function save() {
    if (!draft) return
    void actions.createContext({ projectId: project!.id, title: draft.title, content: draft.content, taskId: draft.taskId || undefined })
    setDraft(null)
  }

  function saveEdit(context: ProjectContextEntry, next: typeof emptyDraft) {
    void actions.saveContext(context.id, { title: next.title, content: next.content, taskId: next.taskId || undefined })
    setEditing(null)
  }

  function remove(context: ProjectContextEntry) {
    void actions.removeContext(context.id)
    setRemoving(null)
  }

  return <>
    <Heading
      level="section"
      eyebrow="PROJETO"
      title="Contexto"
      icon={<Target size={34} />}
      subtitle={`O que o agente sabe sobre ${project.name}. Diferente das notas, o contexto fica disponível para IA e MCP.`}
      action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setDraft(emptyDraft)}>Novo contexto</Button>}
    />

    <div className="overview-grid">
      <section className="view-panel">
        <h3>Aliases</h3>
        <p className="overview-tags">{project.aliases.length ? project.aliases.map((alias) => <span key={alias}>{alias}</span>) : <em>Nenhum alias cadastrado.</em>}</p>
        <h3>Módulos</h3>
        <p className="overview-tags">{project.modules.length ? project.modules.map((module) => <span key={module}>{module}</span>) : <em>Nenhum módulo cadastrado.</em>}</p>
        <h3>Etiquetas</h3>
        {project.tags.length ? <TagChips tags={project.tags} /> : <p className="overview-tags"><em>Nenhuma etiqueta cadastrada.</em></p>}
        <p className="project-context-hint">Aliases, módulos e etiquetas são editados na tela de Projetos.</p>
      </section>
    </div>

    <div className="project-context-list">
      {contexts.map((context) => {
        const linked = tasks.find((task) => task.id === context.taskId)
        return <article className="view-panel project-context-card" key={context.id}>
          <header>
            <strong>{context.title}</strong>
            <div>
              <Button onClick={() => setEditing(context)}>Editar</Button>
              <Button className="project-archive" onClick={() => setRemoving(context)}>Remover</Button>
            </div>
          </header>
          <p>{context.content}</p>
          <footer>
            <small>{context.createdAt}</small>
            {linked
              ? <button className="project-context-task" onClick={() => onOpenTask(linked)}><i style={{ background: linked.color }} />{linked.title}</button>
              : <small>Sem card vinculado</small>}
          </footer>
        </article>
      })}
      {!contexts.length && <div className="view-panel empty-context">
        <Target size={30} />
        <strong>Nenhum contexto registrado</strong>
        <span>Registre regras, decisões e histórico que a IA precisa conhecer antes de classificar.</span>
      </div>}
    </div>

    {draft && <ContextDialog
      title="Novo contexto"
      draft={draft}
      tasks={tasks}
      onChange={(patch) => setDraft((current) => current && { ...current, ...patch })}
      onClose={() => setDraft(null)}
      onSave={save}
    />}

    {editing && <ContextDialogForExisting
      key={editing.id}
      context={editing}
      tasks={tasks}
      onClose={() => setEditing(null)}
      onSave={(next) => saveEdit(editing, next)}
    />}

    {removing && <ConfirmDialog
      title="Remover contexto"
      description={`"${removing.title}" deixa de alimentar a classificação do agente.`}
      confirmLabel="Remover"
      tone="danger"
      onConfirm={() => remove(removing)}
      onCancel={() => setRemoving(null)}
    />}
  </>
}

type ContextDraft = { title: string; content: string; taskId: string }

/**
 * `onChange` recebe só o campo alterado, e o dono aplica com atualização funcional.
 * Espalhar o `draft` capturado aqui perderia uma alteração quando dois campos mudam
 * no mesmo tick, porque o React agrupa as atualizações.
 */
function ContextDialog({ title, draft, tasks, onChange, onClose, onSave }: {
  title: string
  draft: ContextDraft
  tasks: Task[]
  onChange: (patch: Partial<ContextDraft>) => void
  onClose: () => void
  onSave: () => void
}) {
  return <Modal
    title={title}
    eyebrow="CONTEXTO DO PROJETO"
    description="Fica disponível para a IA e para o MCP. Para algo privado, use Notas."
    onClose={onClose}
    footer={<>
      <Button onClick={onClose}>Cancelar</Button>
      <Button variant="primary" disabled={!draft.title.trim() || !draft.content.trim()} onClick={onSave}>Salvar contexto</Button>
    </>}
  >
    <div className="ui-form">
      <label className="ui-form-wide">Título<input autoFocus value={draft.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="A afirmação em uma linha" /></label>
      <label className="ui-form-wide">Conteúdo<textarea value={draft.content} onChange={(event) => onChange({ content: event.target.value })} placeholder="O que a IA precisa saber, e por quê." /></label>
      <label className="ui-form-wide">Card relacionado (opcional)
        <select value={draft.taskId} onChange={(event) => onChange({ taskId: event.target.value })}>
          <option value="">Nenhum</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
      </label>
    </div>
  </Modal>
}

/** Edição carrega o rascunho do contexto aberto; `key` no chamador reinicia o estado. */
function ContextDialogForExisting({ context, tasks, onClose, onSave }: {
  context: ProjectContextEntry
  tasks: Task[]
  onClose: () => void
  onSave: (draft: ContextDraft) => void
}) {
  const [draft, setDraft] = useState<ContextDraft>({ title: context.title, content: context.content, taskId: context.taskId ?? '' })
  return <ContextDialog
    title="Editar contexto"
    draft={draft}
    tasks={tasks}
    onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
    onClose={onClose}
    onSave={() => onSave(draft)}
  />
}
