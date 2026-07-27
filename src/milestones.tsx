'use client'

import { CalendarBlank, CheckCircle, DotsSixVertical, Eye, Flag, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { dragHandleProps, useDropZone } from './dnd'
import {
  addMilestone,
  getMilestoneProgress,
  removeMilestone,
  setTaskMilestones,
  updateMilestone,
  type AppState,
  type Milestone,
  type MilestoneStatus,
  type Task,
} from './domain'
import { ConfirmDialog, Modal } from './ui'

export const milestoneStatuses: MilestoneStatus[] = ['Planejado', 'Em andamento', 'Atingido', 'Adiado', 'Cancelado']

export function MilestonesView({
  state,
  setState,
  notify,
  onOpenTask,
}: {
  state: AppState
  setState: (state: AppState) => void
  notify: (message: string) => void
  onOpenTask: (task: Task) => void
}) {
  const emptyDraft = { name: '', project: state.projects[0]?.name ?? '', targetDate: '', description: '' }
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null)
  const [projectFilter, setProjectFilter] = useState('')
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Milestone | null>(null)
  const visible = useMemo(() => state.milestones
    .filter((milestone) => !projectFilter || milestone.project === projectFilter)
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate)), [projectFilter, state.milestones])
  const reached = state.milestones.filter((milestone) => milestone.status === 'Atingido').length
  const selectedMilestone = state.milestones.find((milestone) => milestone.id === selectedMilestoneId)
  const unlinked = state.tasks.filter((task) =>
    !task.milestoneIds?.length
    && task.status !== 'Concluída'
    && (!projectFilter || task.project === projectFilter)
    && state.milestones.some((milestone) => milestone.project === task.project))

  function create(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const next = addMilestone(state, draft)
    if (next === state) return notify('Informe nome, projeto e data-alvo')
    setState(next)
    setDraft(null)
    notify('Marco criado e disponível no Kanban e roadmap')
  }

  function changeStatus(milestone: Milestone, status: MilestoneStatus) {
    setState(updateMilestone(state, milestone.id, { status }))
    notify(`Marco atualizado: ${status}`)
  }

  function remove(milestone: Milestone) {
    setState(removeMilestone(state, milestone.id))
    setRemoving(null)
    notify('Marco removido; tarefas preservadas')
  }

  function link(taskId: string, milestone: Milestone) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task || task.project !== milestone.project) return notify('A task precisa ser do mesmo projeto do marco')
    if (task.milestoneIds?.includes(milestone.id)) return
    setState(setTaskMilestones(state, taskId, [...(task.milestoneIds ?? []), milestone.id]))
    notify(`"${task.title}" vinculada a ${milestone.name}`)
  }

  function unlink(taskId: string, milestoneId: string) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) return
    setState(setTaskMilestones(state, taskId, (task.milestoneIds ?? []).filter((id) => id !== milestoneId)))
    notify(`"${task.title}" desvinculada`)
  }

  return <div className="milestones-page">
    <div className="page-heading section-heading milestones-heading">
      <div>
        <p className="eyebrow">ENTREGAS-CHAVE</p>
        <h1><Flag size={34} />Marcos</h1>
        <p className="heading-subtitle">Arraste tasks da bandeja para um marco para vincular, e de volta para desvincular.</p>
      </div>
      <button className="primary-button" onClick={() => setDraft(emptyDraft)}><Plus size={18} />Novo marco</button>
    </div>

    <section className="milestone-summary">
      <div><Flag size={20} /><span><strong>{state.milestones.length}</strong> marcos</span></div>
      <div><CheckCircle size={20} /><span><strong>{reached}</strong> atingidos</span></div>
      <label>Projeto
        <select aria-label="Filtrar marcos por projeto" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="">Todos os projetos</option>
          {state.projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
        </select>
      </label>
    </section>

    <MilestoneTray tasks={unlinked} onUnlink={unlink} />

    <div className="milestone-grid">
      {visible.map((milestone) => <MilestoneCard
        key={milestone.id}
        milestone={milestone}
        tasks={state.tasks}
        onOpenTask={onOpenTask}
        onView={() => setSelectedMilestoneId(milestone.id)}
        onStatusChange={(status) => changeStatus(milestone, status)}
        onRemove={() => setRemoving(milestone)}
        onLink={(taskId) => link(taskId, milestone)}
      />)}
      {!visible.length && <div className="view-panel milestone-empty"><Flag size={28} /><strong>Nenhum marco neste projeto</strong><span>Crie primeiro ponto-chave para acompanhar entregas.</span></div>}
    </div>

    {draft && <Modal
      title="Novo marco"
      eyebrow="ENTREGA-CHAVE"
      icon={<Flag size={20} weight="fill" />}
      description="Ponto-chave mensurável do projeto. Não substitui status nem prazo."
      onClose={() => setDraft(null)}
      footer={<>
        <button type="button" className="ghost-button" onClick={() => setDraft(null)}>Cancelar</button>
        <button type="submit" form="milestone-create" className="primary-button">Criar marco</button>
      </>}
    >
      <form id="milestone-create" className="ui-form" onSubmit={create}>
        <label className="ui-form-wide">Nome<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Homologação concluída" required /></label>
        <label>Projeto<select value={draft.project} onChange={(event) => setDraft({ ...draft, project: event.target.value })}>{state.projects.map((project) => <option key={project.id}>{project.name}</option>)}</select></label>
        <label>Data-alvo<input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} required /></label>
        <label className="ui-form-wide">Resultado esperado<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="O que precisa estar verdadeiro quando este marco for atingido?" /></label>
      </form>
    </Modal>}

    {removing && <ConfirmDialog
      title="Remover marco"
      description={`"${removing.name}" será removido. As tarefas são preservadas e apenas o vínculo é desfeito.`}
      confirmLabel="Remover marco"
      onConfirm={() => remove(removing)}
      onCancel={() => setRemoving(null)}
    />}

    {selectedMilestone && <MilestoneDetail
      key={selectedMilestone.id}
      milestone={selectedMilestone}
      state={state}
      setState={setState}
      notify={notify}
      onOpenTask={onOpenTask}
      onClose={() => setSelectedMilestoneId(null)}
    />}
  </div>
}

function MilestoneTray({ tasks, onUnlink }: { tasks: Task[]; onUnlink: (taskId: string, milestoneId: string) => void }) {
  const zone = useDropZone(
    (item) => item.type === 'task' && item.from.startsWith('milestone:'),
    (item) => onUnlink(item.id, item.from.slice('milestone:'.length)),
  )

  return <section className={`milestone-tray ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`} {...zone.dropProps}>
    <header><DotsSixVertical size={17} /><div><strong>Tasks sem marco</strong><span>{tasks.length} disponíveis para vincular</span></div></header>
    <div className="milestone-tray-list">
      {tasks.map((task) => <span
        key={task.id}
        className="milestone-tray-chip"
        style={{ '--project-color': task.color } as React.CSSProperties}
        {...dragHandleProps({ type: 'task', id: task.id, from: 'tray' })}
      ><i />{task.title}<small>{task.project}</small></span>)}
      {!tasks.length && <p>{zone.active ? 'Soltar aqui para desvincular' : 'Todas as tasks elegíveis já estão vinculadas.'}</p>}
    </div>
  </section>
}

function MilestoneCard({
  milestone,
  tasks,
  onOpenTask,
  onView,
  onStatusChange,
  onRemove,
  onLink,
}: {
  milestone: Milestone
  tasks: Task[]
  onOpenTask: (task: Task) => void
  onView: () => void
  onStatusChange: (status: MilestoneStatus) => void
  onRemove: () => void
  onLink: (taskId: string) => void
}) {
  const linked = tasks.filter((task) => task.milestoneIds?.includes(milestone.id))
  const progress = getMilestoneProgress(milestone, tasks)
  const zone = useDropZone(
    (item) => item.type === 'task' && item.from !== `milestone:${milestone.id}`,
    (item) => onLink(item.id),
  )

  return <article
    className={`milestone-card ${zone.active ? 'drop-active' : ''} ${zone.over ? 'drop-over' : ''}`}
    style={{ '--milestone-color': milestone.color } as React.CSSProperties}
    {...zone.dropProps}
  >
    <header>
      <span className={`milestone-state ${slug(milestone.status)}`}>{milestone.status}</span>
      <button className="milestone-remove" aria-label={`Remover marco ${milestone.name}`} onClick={onRemove}><Trash size={15} /></button>
    </header>
    <small className="milestone-project"><i />{milestone.project}</small>
    <h2>{milestone.name}</h2>
    <p>{milestone.description || 'Resultado esperado ainda não descrito.'}</p>
    <div className="milestone-date"><CalendarBlank size={16} /><span>Data-alvo</span><strong>{formatDate(milestone.targetDate)}</strong></div>
    <div className="milestone-progress">
      <div><span>Progresso</span><strong>{progress.completed}/{progress.total} tasks · {progress.percentage}%</strong></div>
      <div className="progress"><b style={{ width: `${progress.percentage}%`, background: milestone.color }} /></div>
    </div>
    <div className="milestone-tasks">
      <small>TASKS VINCULADAS</small>
      {linked.length
        ? linked.map((task) => <button
          key={task.id}
          onClick={() => onOpenTask(task)}
          {...dragHandleProps({ type: 'task', id: task.id, from: `milestone:${milestone.id}` })}
        ><i className={slug(task.status)} />{task.title}<DotsSixVertical className="drag-grip" size={12} /></button>)
        : <span>{zone.active ? 'Soltar para vincular' : 'Arraste uma task da bandeja'}</span>}
    </div>
    <footer>
      <button className="milestone-view-button" onClick={onView}><Eye size={15} />Visualizar</button>
      <label>Status
        <select value={milestone.status} onChange={(event) => onStatusChange(event.target.value as MilestoneStatus)}>
          {milestoneStatuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
    </footer>
  </article>
}

function MilestoneDetail({
  milestone,
  state,
  setState,
  notify,
  onOpenTask,
  onClose,
}: {
  milestone: Milestone
  state: AppState
  setState: (state: AppState) => void
  notify: (message: string) => void
  onOpenTask: (task: Task) => void
  onClose: () => void
}) {
  const initial = {
    name: milestone.name,
    startDate: milestone.startDate ?? '',
    targetDate: milestone.targetDate,
    status: milestone.status,
    description: milestone.description,
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const linked = state.tasks.filter((task) => task.milestoneIds?.includes(milestone.id))
  const progress = getMilestoneProgress(milestone, state.tasks)

  function save(event: FormEvent) {
    event.preventDefault()
    const next = updateMilestone(state, milestone.id, draft)
    if (next === state) return notify('Nome e data-alvo são obrigatórios')
    setState(next)
    setEditing(false)
    notify('Marco editado com sucesso')
  }

  return <Modal
    variant="sheet"
    size="lg"
    accent={milestone.color}
    eyebrow={milestone.project}
    title={editing ? 'Editar marco' : milestone.name}
    icon={<Flag size={20} weight="fill" />}
    onClose={onClose}
    closeLabel="Fechar detalhes do marco"
    footer={editing
      ? <>
        <button type="button" className="ghost-button" onClick={() => { setDraft(initial); setEditing(false) }}>Cancelar</button>
        <button type="submit" form="milestone-edit" className="primary-button">Salvar alterações</button>
      </>
      : <button type="button" className="primary-button" onClick={() => setEditing(true)}><PencilSimple size={16} />Editar marco</button>}
  >
    {editing ? <form id="milestone-edit" className="ui-form" onSubmit={save}>
      <label className="ui-form-wide">Nome<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
      <label className="ui-form-wide">Projeto<input value={milestone.project} disabled title="Projeto não pode ser alterado enquanto existem vínculos" /></label>
      <label>Data de início<input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <label>Data-alvo<input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} required /></label>
      <label className="ui-form-wide">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as MilestoneStatus })}>{milestoneStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="ui-form-wide">Resultado esperado<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Descreva o resultado que torna este marco atingido." /></label>
    </form> : <>
      <div className="milestone-detail-overview">
        <span className={`milestone-state ${slug(milestone.status)}`}>{milestone.status}</span>
        <p>{milestone.description || 'Resultado esperado ainda não descrito.'}</p>
      </div>
      <div className="milestone-detail-metrics">
        <div><small>INÍCIO</small><strong>{milestone.startDate ? formatDate(milestone.startDate) : 'Não definido'}</strong></div>
        <div><small>DATA-ALVO</small><strong>{formatDate(milestone.targetDate)}</strong></div>
        <div><small>PROGRESSO</small><strong>{progress.percentage}%</strong><span>{progress.completed} de {progress.total} tasks concluídas</span></div>
      </div>
      <div className="milestone-detail-progress"><div className="progress"><b style={{ width: `${progress.percentage}%`, background: milestone.color }} /></div></div>
      <section className="milestone-detail-tasks">
        <header><div><strong>Tasks vinculadas</strong><span>{linked.length} participantes deste marco</span></div></header>
        {linked.length ? linked.map((task) => <button key={task.id} onClick={() => onOpenTask(task)}>
          <i style={{ background: task.color }} /><span><strong>{task.title}</strong><small>{task.module ?? 'Geral'} · {task.status}</small></span><b>{task.priority}</b>
        </button>) : <div className="milestone-detail-empty"><Flag size={22} /><span>Nenhuma task vinculada.</span></div>}
      </section>
    </>}
  </Modal>
}

export function MilestoneBadges({ milestoneIds, milestones }: { milestoneIds?: string[]; milestones: Milestone[] }) {
  const linked = milestones.filter((milestone) => milestoneIds?.includes(milestone.id))
  if (!linked.length) return <span className="milestone-badge empty"><Flag size={11} />Sem marco</span>
  return <span className="milestone-badges">{linked.map((milestone) =>
    <span className="milestone-badge" style={{ '--milestone-color': milestone.color } as React.CSSProperties} key={milestone.id}><Flag size={11} weight="fill" />{milestone.name}</span>)}</span>
}

export function TaskMilestoneSelector({
  task,
  milestones,
  onChange,
}: {
  task: Task
  milestones: Milestone[]
  onChange: (milestoneIds: string[]) => void
}) {
  const available = milestones.filter((milestone) => milestone.project === task.project && milestone.status !== 'Cancelado')
  function toggle(milestoneId: string) {
    const selected = task.milestoneIds ?? []
    onChange(selected.includes(milestoneId) ? selected.filter((id) => id !== milestoneId) : [...selected, milestoneId])
  }
  return <div className="task-milestone-selector">
    {available.length ? available.map((milestone) => <label key={milestone.id}>
      <input type="checkbox" checked={task.milestoneIds?.includes(milestone.id) ?? false} onChange={() => toggle(milestone.id)} />
      <i style={{ background: milestone.color }} />
      <span>{milestone.name}<small>{formatDate(milestone.targetDate)}</small></span>
    </label>) : <span>Nenhum marco disponível para este projeto.</span>}
  </div>
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function slug(value: string): string {
  return value.toLocaleLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[̀-ͯ]/g, '')
}
