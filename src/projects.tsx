'use client'

import { ArrowRight, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { priorities, type AppState, type Priority, type Project } from './domain'
import { splitList } from './format'
import { Heading } from './heading'
import type { ProjectActions } from './lib/store'
import { Button, ConfirmDialog, Modal, PriorityPill } from './ui'

export function ProjectsView({ state, actions, onOpenProject }: { state: AppState; actions: ProjectActions; onOpenProject: (projectId: string) => void }) {
  const empty = { name: '', description: '', priority: 'P2' as Priority, aliases: '', modules: '', tags: '' }
  const [form, setForm] = useState<typeof empty | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<Project | null>(null)
  const patch = (value: Partial<typeof empty>) => setForm((current) => current ? { ...current, ...value } : current)

  function openCreate() { setEditing(null); setForm(empty) }
  function openEdit(project: Project) {
    setEditing(project.id)
    setForm({
      name: project.name,
      description: project.description,
      priority: project.priority,
      aliases: project.aliases.join(', '),
      modules: project.modules.join(', '),
      tags: project.tags.map((tag) => tag.name).join(', '),
    })
  }

  function save() {
    if (!form) return
    if (!editing) {
      void actions.createProject({ name: form.name, description: form.description, color: '#68d7a7', priority: form.priority })
    } else {
      void actions.saveProject(editing, {
        name: form.name,
        description: form.description,
        priority: form.priority,
        aliases: splitList(form.aliases),
        modules: splitList(form.modules),
        tags: splitList(form.tags),
      })
    }
    setForm(null)
    setEditing(null)
  }

  function archive(project: Project) {
    void actions.toggleArchived(project.id)
    setArchiving(null)
  }

  return <>
    <Heading title="Projetos" subtitle="Quadros ativos e arquivados que alimentam todas as visões." action={<Button variant="primary" icon={<Plus size={18} />} onClick={openCreate}>Novo projeto</Button>} />

    <div className="project-grid">
      {state.projects.map((project) => <article className={`project-card ${project.archived ? 'archived' : ''}`} key={project.id} style={{ '--project-color': project.color } as React.CSSProperties}>
        <button className="project-card-main" onClick={() => onOpenProject(project.id)}>
          <i />
          <div>
            <span className="project-card-top"><strong>{project.name}</strong><PriorityPill priority={project.priority} /></span>
            <span className="project-card-description">{project.description || 'Sem descrição cadastrada.'}</span>
            <div className="progress"><b style={{ width: `${project.progress}%`, background: project.color }} /></div>
            <small>{project.archived ? 'Arquivado' : `${project.progress}% concluído`} · {project.aliases.length} aliases · {project.modules.length} módulos</small>
          </div>
          <ArrowRight size={18} />
        </button>
        <div className="project-card-actions">
          <Button onClick={() => openEdit(project)}>Editar</Button>
          <Button className="project-archive" onClick={() => setArchiving(project)}>{project.archived ? 'Reativar' : 'Arquivar'}</Button>
        </div>
      </article>)}
    </div>

    {form && <Modal
      title={editing ? 'Editar projeto' : 'Novo projeto'}
      eyebrow="PROJETO"
      description={editing ? 'Aliases e módulos alimentam a classificação do agente.' : 'Um projeto é um quadro com tarefas, marcos e contexto próprio.'}
      onClose={() => { setForm(null); setEditing(null) }}
      footer={<>
        <Button onClick={() => { setForm(null); setEditing(null) }}>Cancelar</Button>
        <Button variant="primary" onClick={save}>{editing ? 'Salvar alterações' : 'Criar projeto'}</Button>
      </>}
    >
      <div className="ui-form">
        <label>Nome<input autoFocus value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Nome do projeto" /></label>
        <label>Descrição<input value={form.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Objetivo ou contexto" /></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => patch({ priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        {editing && <>
          <label className="ui-form-wide">Aliases separados por vírgula<input value={form.aliases} onChange={(event) => patch({ aliases: event.target.value })} placeholder="PAX, nome antigo" /></label>
          <label className="ui-form-wide">Módulos separados por vírgula<input value={form.modules} onChange={(event) => patch({ modules: event.target.value })} placeholder="Mapa, API" /></label>
          <label className="ui-form-wide">Etiquetas separadas por vírgula<input value={form.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder="raster, CEGEO" /><small>Etiqueta em uso por algum card permanece mesmo se sair desta lista.</small></label>
        </>}
      </div>
    </Modal>}

    {archiving && <ConfirmDialog
      title={archiving.archived ? 'Reativar projeto' : 'Arquivar projeto'}
      description={archiving.archived
        ? `"${archiving.name}" volta a aparecer no Kanban e nos filtros.`
        : `"${archiving.name}" sai do Kanban e dos filtros. As tarefas são preservadas.`}
      confirmLabel={archiving.archived ? 'Reativar' : 'Arquivar'}
      tone={archiving.archived ? 'default' : 'danger'}
      onConfirm={() => archive(archiving)}
      onCancel={() => setArchiving(null)}
    />}
  </>
}
