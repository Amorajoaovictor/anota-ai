'use client'

import { CalendarBlank, Clock, PencilSimple, Plus, Trash, UsersThree } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { scopeMeetings, scopeProject, scopeProjects, type AppState, type Meeting, type Scope } from './domain'
import type { ProjectActions } from './lib/store'
import { Heading } from './heading'
import { Button, ConfirmDialog, EmptyState, Modal } from './ui'

type MeetingDraft = { projectId: string; title: string; description: string; startsAt: string; endsAt: string; link: string }

export function MeetingsView({ state, scope, actions }: { state: AppState; scope: Scope; actions: ProjectActions }) {
  const scoped = scopeProject(state, scope)
  const projects = scopeProjects(state, scope)
  const meetings = useMemo(() => scopeMeetings(state, scope), [state, scope])
  const [editing, setEditing] = useState<Meeting | MeetingDraft | null>(null)
  const [removing, setRemoving] = useState<Meeting | null>(null)

  return <>
    <Heading
      level="section"
      title="Reuniões"
      icon={<UsersThree size={34} />}
      subtitle={scoped ? `Agenda de ${scoped.name}.` : 'Agenda de todos os projetos e reuniões avulsas.'}
      action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing(newDraft(scoped?.id))}>Nova reunião</Button>}
    />
    {meetings.length ? <div className="meetings-list">
      {meetings.map((meeting) => <article className="meeting-card view-panel" key={meeting.id}>
        <div className="meeting-date"><CalendarBlank size={18} /><time dateTime={meeting.startsAt}>{formatMeetingDate(meeting.startsAt)}</time></div>
        <div className="meeting-main">
          <small><i style={{ background: meeting.color ?? '#60706e' }} />{meeting.project ?? 'Sem projeto'}</small>
          <h2>{meeting.title}</h2>
          {meeting.description && <p>{meeting.description}</p>}
          <span><Clock size={14} />{formatMeetingTime(meeting.startsAt, meeting.endsAt)}</span>
          {meeting.link && <a href={meeting.link} target="_blank" rel="noreferrer">Abrir link</a>}
        </div>
        <div className="meeting-actions"><button aria-label={`Editar ${meeting.title}`} onClick={() => setEditing(meeting)}><PencilSimple size={17} /></button><button aria-label={`Remover ${meeting.title}`} onClick={() => setRemoving(meeting)}><Trash size={17} /></button></div>
      </article>)}
    </div> : <EmptyState size="page" icon={<UsersThree size={36} />} title="Nenhuma reunião neste escopo" description="Registre um encontro para acompanhar decisões, participantes e próximos passos." action={<Button variant="primary" onClick={() => setEditing(newDraft(scoped?.id))}>Nova reunião</Button>} />}
    {editing && <MeetingDialog meeting={isMeeting(editing) ? editing : undefined} defaultProjectId={scoped?.id} projects={projects} onClose={() => setEditing(null)} onSave={(input) => {
      if (isMeeting(editing)) void actions.saveMeeting(editing.id, input)
      else void actions.createMeeting(input)
      setEditing(null)
    }} />}
    {removing && <ConfirmDialog title="Remover reunião" description={`Remover “${removing.title}”? Esta ação não pode ser desfeita.`} confirmLabel="Remover" onConfirm={() => { void actions.removeMeeting(removing.id); setRemoving(null) }} onCancel={() => setRemoving(null)} />}
  </>
}

function MeetingDialog({ meeting, defaultProjectId, projects, onClose, onSave }: { meeting?: Meeting; defaultProjectId?: string; projects: AppState['projects']; onClose: () => void; onSave: (input: { projectId: string | null; title: string; description: string; startsAt: string; endsAt: string | null; timezone: string; link: string | null }) => void }) {
  const [draft, setDraft] = useState<MeetingDraft>(() => meeting ? {
    projectId: meeting.projectId ?? '', title: meeting.title, description: meeting.description,
    startsAt: toDateTimeInput(meeting.startsAt), endsAt: meeting.endsAt ? toDateTimeInput(meeting.endsAt) : '', link: meeting.link ?? '',
  } : newDraft(defaultProjectId))
  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim() || !draft.startsAt) return
    onSave({ projectId: draft.projectId || null, title: draft.title, description: draft.description, startsAt: new Date(draft.startsAt).toISOString(), endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null, timezone: 'America/Sao_Paulo', link: draft.link.trim() || null })
  }
  return <Modal title={meeting ? 'Editar reunião' : 'Nova reunião'} icon={<UsersThree size={20} />} onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><button className="primary-button" form="meeting-form" type="submit">{meeting ? 'Salvar' : 'Criar reunião'}</button></>}>
    <form id="meeting-form" className="ui-form" onSubmit={save}>
      <label className="ui-form-wide">Título<input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>Projeto<select aria-label="Projeto da reunião" value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}><option value="">Sem projeto</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      <label>Início<input required type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label>
      <label>Fim<input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label>
      <label>Link<input type="url" placeholder="https://..." value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value })} /></label>
      <label className="ui-form-wide">Descrição<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Objetivo, decisões e encaminhamentos." /></label>
    </form>
  </Modal>
}

function newDraft(projectId?: string): MeetingDraft { return { projectId: projectId ?? '', title: '', description: '', startsAt: '', endsAt: '', link: '' } }
function isMeeting(value: Meeting | MeetingDraft): value is Meeting { return 'id' in value }
function toDateTimeInput(value: string) { const date = new Date(value); const pad = (number: number) => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}` }
function formatMeetingDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value)) }
function formatMeetingTime(startsAt: string, endsAt?: string) { const format = (value: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); return endsAt ? `${format(startsAt)}–${format(endsAt)}` : format(startsAt) }
