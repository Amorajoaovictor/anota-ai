'use client'

import { DotsSixVertical, Kanban, LockKey, MagnifyingGlass, NotePencil, Plus, PushPin, X } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { dragHandleProps, reorderKeyProps, useDropZone, type DragItem } from './dnd'
import { filterNotes, scopeNotes, scopeProject, scopeProjects, scopeTasks, type AppState, type Note, type Scope, type Task } from './domain'
import type { ProjectActions } from './lib/store'
import { Button, EmptyState, Modal, PageHeading, type Notify } from './ui'

type NotesViewProps = {
  state: AppState
  scope: Scope
  actions: ProjectActions
  notify: Notify
}

export function NotesView({ state, scope, actions, notify }: NotesViewProps) {
  const scoped = scopeProject(state, scope)
  const projects = scopeProjects(state, scope)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [query, setQuery] = useState('')
  const [composerProject, setComposerProject] = useState('')
  const [composerTask, setComposerTask] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [convertingNote, setConvertingNote] = useState<Note | null>(null)
  const inScope = useMemo(() => scopeNotes(state, scope), [state, scope])
  const visibleNotes = useMemo(() => filterNotes(inScope, query), [inScope, query])
  const pinnedNotes = visibleNotes.filter((note) => note.pinned)
  const otherNotes = visibleNotes.filter((note) => !note.pinned)
  // Toda nota pertence a um projeto: no escopo global o autor escolhe qual.
  const targetProjectId = scoped?.id ?? composerProject
  // O vínculo só pode apontar para card do projeto escolhido.
  const composerTasks = useMemo(
    () => state.tasks.filter((task) => task.project === state.projects.find((project) => project.id === targetProjectId)?.name),
    [state.tasks, state.projects, targetProjectId],
  )
  const tasksInScope = useMemo(() => scopeTasks(state, scope), [state, scope])
  // Dentro do projeto o nome seria repetido em todo card.
  const projectNameOf = (note: Note) => scoped ? undefined : state.projects.find((project) => project.id === note.projectId)?.name
  const taskOf = (note: Note) => tasksInScope.find((task) => task.id === note.taskId)

  function saveNote() {
    if (!targetProjectId) return notify('Escolha o projeto da nota')
    void actions.createNote({ title, content, projectId: targetProjectId, taskId: composerTask || undefined })
    setTitle('')
    setContent('')
    setComposerProject('')
    setComposerTask('')
    setComposerOpen(false)
  }

  function saveEdit(note: Note, nextTitle: string, nextContent: string, nextTaskId: string) {
    void actions.saveNote(note.id, { title: nextTitle, content: nextContent, taskId: nextTaskId || undefined })
    setEditingNote(null)
  }

  function pin(note: Note) {
    void actions.toggleNotePin(note.id)
  }

  function convert(note: Note, project: string) {
    void actions.convertNote(note.id, project)
    setConvertingNote(null)
  }

  function drop(item: DragItem, targetPinned: boolean, beforeNoteId?: string) {
    void actions.moveNote(item.id, targetPinned, beforeNoteId)
  }

  return <div className="notes-page">
    <PageHeading
      level="section"
      className="keep-heading"
      eyebrow="ESPAÇO PESSOAL"
      title="Notas"
      icon={<NotePencil size={34} />}
      subtitle={scoped ? `Notas privadas de ${scoped.name}.` : undefined}
      action={<div className="keep-privacy"><LockKey size={16} /><span>Privadas · fora de IA e MCP</span></div>}
    />

    <div className="keep-workspace">
      <label className="notes-search">
        <MagnifyingGlass size={19} />
        <input aria-label="Pesquisar notas" placeholder="Pesquisar nas notas" value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button aria-label="Limpar pesquisa" onClick={() => setQuery('')}><X size={17} /></button>}
      </label>

      {composerOpen
        ? <section className="keep-composer expanded">
          <input autoFocus aria-label="Título da nota" placeholder="Título" value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea aria-label="Conteúdo da nota" placeholder="Criar uma nota..." value={content} onChange={(event) => setContent(event.target.value)} />
          {!scoped && <select aria-label="Projeto da nota" className="keep-composer-project" value={composerProject} onChange={(event) => { setComposerProject(event.target.value); setComposerTask('') }}>
            <option value="">Selecione o projeto</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>}
          {Boolean(targetProjectId) && <select aria-label="Card relacionado" className="keep-composer-project" value={composerTask} onChange={(event) => setComposerTask(event.target.value)}>
            <option value="">Sem card relacionado</option>
            {composerTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>}
          <footer><span><LockKey size={14} />Nota privada</span><div><button className="keep-close" onClick={() => { setComposerOpen(false); setTitle(''); setContent(''); setComposerProject(''); setComposerTask('') }}>Fechar</button><Button variant="primary" icon={<Plus size={16} />} disabled={!content.trim() || !targetProjectId} onClick={saveNote}>Salvar</Button></div></footer>
        </section>
        : <button className="keep-composer collapsed" onClick={() => setComposerOpen(true)}><span>Criar uma nota...</span><NotePencil size={20} /></button>}

      {visibleNotes.length === 0
        ? <EmptyState icon={<NotePencil size={38} />} title={query ? 'Nenhuma nota encontrada' : 'Suas notas aparecem aqui'} description={query ? 'Tente pesquisar outro termo.' : 'Crie primeira nota usando campo acima.'} />
        : <div className="notes-board">
          <NotesSection title="Fixadas" pinned notes={pinnedNotes} projectNameOf={projectNameOf} taskOf={taskOf} onDrop={drop} onEdit={setEditingNote} onPin={pin} onConvert={setConvertingNote} />
          <NotesSection title={pinnedNotes.length > 0 ? 'Outras' : 'Notas'} pinned={false} notes={otherNotes} projectNameOf={projectNameOf} taskOf={taskOf} onDrop={drop} onEdit={setEditingNote} onPin={pin} onConvert={setConvertingNote} />
        </div>}
    </div>

    {editingNote && <NoteEditDialog
      key={editingNote.id}
      note={editingNote}
      tasks={state.tasks.filter((task) => task.project === state.projects.find((project) => project.id === editingNote.projectId)?.name)}
      onClose={() => setEditingNote(null)}
      onSave={(nextTitle, nextContent, nextTaskId) => saveEdit(editingNote, nextTitle, nextContent, nextTaskId)}
    />}
    {convertingNote && <NoteConvertDialog note={convertingNote} state={state} onClose={() => setConvertingNote(null)} onConfirm={(project) => convert(convertingNote, project)} />}
  </div>
}

type SectionProps = {
  title: string
  pinned: boolean
  notes: Note[]
  projectNameOf: (note: Note) => string | undefined
  taskOf: (note: Note) => Task | undefined
  onDrop: (item: DragItem, targetPinned: boolean, beforeNoteId?: string) => void
  onEdit: (note: Note) => void
  onPin: (note: Note) => void
  onConvert: (note: Note) => void
}

function NotesSection({ title, pinned, notes, projectNameOf, taskOf, onDrop, onEdit, onPin, onConvert }: SectionProps) {
  const zone = useDropZone((item) => item.type === 'note', (item) => onDrop(item, pinned))
  if (!notes.length && !zone.active) return null

  function moveByKeyboard(noteId: string, direction: -1 | 1) {
    const index = notes.findIndex((note) => note.id === noteId)
    if (index < 0) return
    if (direction === -1 && index === 0) return
    if (direction === 1 && index === notes.length - 1) return
    const beforeId = direction === -1 ? notes[index - 1]?.id : notes[index + 2]?.id
    onDrop({ type: 'note', id: noteId, from: pinned ? 'pinned' : 'others' }, pinned, beforeId)
  }

  return <section className={`keep-section ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`} {...zone.dropProps}>
    <h2>{title}{pinned && <PushPin size={11} weight="fill" />}</h2>
    <div className="keep-grid">
      {notes.map((note) => <NoteCard key={note.id} note={note} projectName={projectNameOf(note)} task={taskOf(note)} onDrop={onDrop} onMove={(direction) => moveByKeyboard(note.id, direction)} onEdit={onEdit} onPin={onPin} onConvert={onConvert} />)}
    </div>
    {!notes.length && <p className="keep-section-hint">Soltar aqui para {pinned ? 'fixar' : 'desafixar'}</p>}
  </section>
}

function NoteCard({ note, projectName, task, onDrop, onMove, onEdit, onPin, onConvert }: { note: Note; projectName?: string; task?: Task; onMove: (direction: -1 | 1) => void } & Pick<SectionProps, 'onDrop' | 'onEdit' | 'onPin' | 'onConvert'>) {
  const zone = useDropZone((item) => item.type === 'note' && item.id !== note.id, (item) => onDrop(item, note.pinned, note.id))

  return <article
    className={`keep-card ${zone.over ? 'drop-before' : ''}`}
    onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onEdit(note) }}
    {...dragHandleProps({ type: 'note', id: note.id, from: note.pinned ? 'pinned' : 'others' })}
    {...reorderKeyProps(onMove)}
    aria-label={`${note.title}. Alt seta para cima ou para baixo reordena.`}
    {...zone.dropProps}
  >
    <DotsSixVertical className="drag-grip keep-grip" size={15} />
    <button className={`pin-button ${note.pinned ? 'active' : ''}`} aria-label={note.pinned ? `Desafixar ${note.title}` : `Fixar ${note.title}`} onClick={() => onPin(note)}><PushPin size={18} weight={note.pinned ? 'fill' : 'regular'} /></button>
    {projectName && <small className="keep-card-project">{projectName}</small>}
    <h3>{note.title}</h3>
    <p>{note.content}</p>
    {task && <small className="keep-card-task"><Kanban size={12} />{task.title}</small>}
    <footer>
      <span title="Nota privada"><LockKey size={15} /></span>
      <button aria-label={`Editar ${note.title}`} onClick={() => onEdit(note)}><NotePencil size={17} /><span>Editar</span></button>
      {note.convertedTaskId
        ? <span className="keep-created"><Kanban size={15} />Card criado</span>
        : <button aria-label={`Converter ${note.title} em card`} onClick={() => onConvert(note)}><Kanban size={17} /><span>Converter</span></button>}
      <small>{note.createdAt}</small>
    </footer>
  </article>
}

function NoteEditDialog({ note, tasks, onClose, onSave }: { note: Note; tasks: Task[]; onClose: () => void; onSave: (title: string, content: string, taskId: string) => void }) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [taskId, setTaskId] = useState(note.taskId ?? '')

  return <Modal
    title="Editar nota"
    eyebrow="NOTA PRIVADA"
    icon={<LockKey size={18} />}
    onClose={onClose}
    closeLabel="Fechar edição"
    footer={<>
      <span className="ui-modal-hint">{content.trim().length} caracteres</span>
      <Button onClick={onClose}>Cancelar</Button>
      <Button variant="primary" disabled={!content.trim()} onClick={() => onSave(title, content, taskId)}>Salvar alterações</Button>
    </>}
  >
    <div className="note-dialog-fields">
      <input autoFocus aria-label="Editar título da nota" placeholder="Título" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea aria-label="Editar conteúdo da nota" placeholder="Conteúdo da nota" value={content} onChange={(event) => setContent(event.target.value)} />
      <select aria-label="Card relacionado" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
        <option value="">Sem card relacionado</option>
        {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
      </select>
    </div>
  </Modal>
}

function NoteConvertDialog({ note, state, onClose, onConfirm }: { note: Note; state: AppState; onClose: () => void; onConfirm: (project: string) => void }) {
  const [project, setProject] = useState(() => state.projects.find((item) => item.id === note.projectId)?.name ?? '')

  return <Modal
    size="sm"
    title="Converter em card"
    eyebrow="NOTA → BACKLOG"
    icon={<Kanban size={18} />}
    description="A nota continua privada. Um card é criado no Backlog do projeto escolhido."
    onClose={onClose}
    footer={<>
      <Button onClick={onClose}>Cancelar</Button>
      <Button variant="primary" disabled={!project} onClick={() => onConfirm(project)}>Criar card</Button>
    </>}
  >
    <div className="ui-form">
      <label className="ui-form-wide">Título do card<input value={note.title} disabled /></label>
      <label className="ui-form-wide">Projeto
        <select autoFocus aria-label={`Projeto para ${note.title}`} value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">Selecione projeto</option>
          {state.projects.filter((item) => !item.archived).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
      </label>
    </div>
  </Modal>
}
