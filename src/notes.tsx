'use client'

import { DotsSixVertical, Kanban, LockKey, MagnifyingGlass, NotePencil, Plus, PushPin, X } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { dragHandleProps, useDropZone, type DragItem } from './dnd'
import { addNote, convertNoteToTask, filterNotes, reorderNotes, toggleNotePinned, updateNote, type AppState, type Note } from './domain'
import { Modal } from './ui'

type NotesViewProps = {
  state: AppState
  setState: (state: AppState) => void
  notify: (message: string) => void
}

export function NotesView({ state, setState, notify }: NotesViewProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [convertingNote, setConvertingNote] = useState<Note | null>(null)
  const visibleNotes = useMemo(() => filterNotes(state.notes, query), [state.notes, query])
  const pinnedNotes = visibleNotes.filter((note) => note.pinned)
  const otherNotes = visibleNotes.filter((note) => !note.pinned)

  function saveNote() {
    const next = addNote(state, { title, content })
    if (next === state) return
    setState(next)
    setTitle('')
    setContent('')
    setComposerOpen(false)
    notify('Nota privada salva')
  }

  function saveEdit(note: Note, nextTitle: string, nextContent: string) {
    const next = updateNote(state, note.id, { title: nextTitle, content: nextContent })
    if (next === state) return
    setState(next)
    setEditingNote(null)
    notify('Nota atualizada')
  }

  function pin(note: Note) {
    setState(toggleNotePinned(state, note.id))
    notify(note.pinned ? 'Nota removida das fixadas' : 'Nota fixada')
  }

  function convert(note: Note, project: string) {
    const next = convertNoteToTask(state, note.id, project)
    if (next === state) return notify('Selecione um projeto válido')
    setState(next)
    setConvertingNote(null)
    notify('Nota convertida em card no Backlog')
  }

  function drop(item: DragItem, targetPinned: boolean, beforeNoteId?: string) {
    const note = state.notes.find((entry) => entry.id === item.id)
    if (!note) return
    let next = note.pinned === targetPinned ? state : toggleNotePinned(state, note.id)
    next = reorderNotes(next, note.id, beforeNoteId)
    if (next === state) return
    setState(next)
    notify(note.pinned === targetPinned ? 'Ordem das notas atualizada' : targetPinned ? 'Nota fixada' : 'Nota removida das fixadas')
  }

  return <div className="notes-page">
    <div className="page-heading section-heading keep-heading">
      <div><p className="eyebrow">ESPAÇO PESSOAL</p><h1><NotePencil size={34} />Notas</h1></div>
      <div className="keep-privacy"><LockKey size={16} /><span>Privadas · fora de IA e MCP</span></div>
    </div>

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
          <footer><span><LockKey size={14} />Nota privada</span><div><button className="keep-close" onClick={() => { setComposerOpen(false); setTitle(''); setContent('') }}>Fechar</button><button className="primary-button" disabled={!content.trim()} onClick={saveNote}><Plus size={16} />Salvar</button></div></footer>
        </section>
        : <button className="keep-composer collapsed" onClick={() => setComposerOpen(true)}><span>Criar uma nota...</span><NotePencil size={20} /></button>}

      {visibleNotes.length === 0
        ? <div className="keep-empty"><NotePencil size={38} /><strong>{query ? 'Nenhuma nota encontrada' : 'Suas notas aparecem aqui'}</strong><span>{query ? 'Tente pesquisar outro termo.' : 'Crie primeira nota usando campo acima.'}</span></div>
        : <div className="notes-board">
          <NotesSection title="Fixadas" pinned notes={pinnedNotes} onDrop={drop} onEdit={setEditingNote} onPin={pin} onConvert={setConvertingNote} />
          <NotesSection title={pinnedNotes.length > 0 ? 'Outras' : 'Notas'} pinned={false} notes={otherNotes} onDrop={drop} onEdit={setEditingNote} onPin={pin} onConvert={setConvertingNote} />
        </div>}
    </div>

    {editingNote && <NoteEditDialog note={editingNote} onClose={() => setEditingNote(null)} onSave={(nextTitle, nextContent) => saveEdit(editingNote, nextTitle, nextContent)} />}
    {convertingNote && <NoteConvertDialog note={convertingNote} state={state} onClose={() => setConvertingNote(null)} onConfirm={(project) => convert(convertingNote, project)} />}
  </div>
}

type SectionProps = {
  title: string
  pinned: boolean
  notes: Note[]
  onDrop: (item: DragItem, targetPinned: boolean, beforeNoteId?: string) => void
  onEdit: (note: Note) => void
  onPin: (note: Note) => void
  onConvert: (note: Note) => void
}

function NotesSection({ title, pinned, notes, onDrop, onEdit, onPin, onConvert }: SectionProps) {
  const zone = useDropZone((item) => item.type === 'note', (item) => onDrop(item, pinned))
  if (!notes.length && !zone.active) return null

  return <section className={`keep-section ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`} {...zone.dropProps}>
    <h2>{title}{pinned && <PushPin size={11} weight="fill" />}</h2>
    <div className="keep-grid">
      {notes.map((note) => <NoteCard key={note.id} note={note} onDrop={onDrop} onEdit={onEdit} onPin={onPin} onConvert={onConvert} />)}
    </div>
    {!notes.length && <p className="keep-section-hint">Soltar aqui para {pinned ? 'fixar' : 'desafixar'}</p>}
  </section>
}

function NoteCard({ note, onDrop, onEdit, onPin, onConvert }: { note: Note } & Pick<SectionProps, 'onDrop' | 'onEdit' | 'onPin' | 'onConvert'>) {
  const zone = useDropZone((item) => item.type === 'note' && item.id !== note.id, (item) => onDrop(item, note.pinned, note.id))

  return <article
    className={`keep-card ${zone.over ? 'drop-before' : ''}`}
    onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onEdit(note) }}
    {...dragHandleProps({ type: 'note', id: note.id, from: note.pinned ? 'pinned' : 'others' })}
    {...zone.dropProps}
  >
    <DotsSixVertical className="drag-grip keep-grip" size={15} />
    <button className={`pin-button ${note.pinned ? 'active' : ''}`} aria-label={note.pinned ? `Desafixar ${note.title}` : `Fixar ${note.title}`} onClick={() => onPin(note)}><PushPin size={18} weight={note.pinned ? 'fill' : 'regular'} /></button>
    <h3>{note.title}</h3>
    <p>{note.content}</p>
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

function NoteEditDialog({ note, onClose, onSave }: { note: Note; onClose: () => void; onSave: (title: string, content: string) => void }) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)

  return <Modal
    title="Editar nota"
    eyebrow="NOTA PRIVADA"
    icon={<LockKey size={18} />}
    onClose={onClose}
    closeLabel="Fechar edição"
    footer={<>
      <span className="ui-modal-hint">{content.trim().length} caracteres</span>
      <button className="ghost-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={!content.trim()} onClick={() => onSave(title, content)}>Salvar alterações</button>
    </>}
  >
    <div className="note-dialog-fields">
      <input autoFocus aria-label="Editar título da nota" placeholder="Título" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea aria-label="Editar conteúdo da nota" placeholder="Conteúdo da nota" value={content} onChange={(event) => setContent(event.target.value)} />
    </div>
  </Modal>
}

function NoteConvertDialog({ note, state, onClose, onConfirm }: { note: Note; state: AppState; onClose: () => void; onConfirm: (project: string) => void }) {
  const [project, setProject] = useState('')

  return <Modal
    size="sm"
    title="Converter em card"
    eyebrow="NOTA → BACKLOG"
    icon={<Kanban size={18} />}
    description="A nota continua privada. Um card é criado no Backlog do projeto escolhido."
    onClose={onClose}
    footer={<>
      <button className="ghost-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={!project} onClick={() => onConfirm(project)}>Criar card</button>
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
