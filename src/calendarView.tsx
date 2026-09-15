'use client'

import { CalendarBlank, CaretLeft, CaretRight, Flag, Target } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { buildAgendaEntries, buildCalendarMonth, formatCalendarMonth, groupCalendarEntries, type CalendarEntry } from './calendar'
import { scopeMilestones, scopeProject, scopeTasks, type AppState, type Scope, type Task } from './domain'
import { formatDate } from './format'
import { Heading } from './heading'
import { Button } from './ui'

export function CalendarView({ state, scope, onOpenTask }: { state: AppState; scope: Scope; onOpenTask: (task: Task) => void }) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<'calendar' | 'agenda'>('calendar')
  const tasks = useMemo(() => scopeTasks(state, scope), [state, scope])
  const milestones = useMemo(() => scopeMilestones(state, scope), [state, scope])
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const days = useMemo(() => buildCalendarMonth(anchor), [anchor])
  const entries = useMemo(() => groupCalendarEntries(tasks, milestones, days), [tasks, milestones, days])
  const agenda = useMemo(() => buildAgendaEntries(days, entries), [days, entries])
  const scoped = scopeProject(state, scope)

  function moveMonth(offset: number) {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return <>
    <Heading
      level="section"
      title="Calendário"
      icon={<CalendarBlank size={34} />}
      subtitle={scoped ? `Agenda de ${scoped.name}. Prazo, previsão e marcos usam data completa.` : 'Agenda de todos os projetos. Prazo, previsão e marcos usam data completa.'}
    />
    <section className="calendar-view view-panel" aria-label="Agenda mensal">
      <header className="calendar-toolbar">
        <button aria-label="Mês anterior" onClick={() => moveMonth(-1)}><CaretLeft size={18} /></button>
        <strong>{formatCalendarMonth(anchor)}</strong>
        <button aria-label="Próximo mês" onClick={() => moveMonth(1)}><CaretRight size={18} /></button>
        <div className="calendar-mode" role="group" aria-label="Modo de visualização">
          <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendário</button>
          <button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Agenda</button>
        </div>
        <Button onClick={() => setAnchor(new Date())}>Hoje</Button>
      </header>
      {view === 'calendar' ? <>
        <div className="calendar-weekdays">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((day) => <section key={day.date} className={`calendar-day ${day.inMonth ? '' : 'outside'} ${day.isToday ? 'today' : ''}`}>
          <time dateTime={day.date}>{day.day}</time>
          <div className="calendar-entries">{(entries.get(day.date) ?? []).map((entry) => <CalendarEntryItem key={entry.id} entry={entry} taskById={taskById} onOpenTask={onOpenTask} />)}</div>
        </section>)}</div>
      </> : <div className="agenda-list">
        {agenda.length ? agenda.map((day) => <section className="agenda-day" key={day.date}>
          <time dateTime={day.date}>{formatDate(day.date)}</time>
          <div>{day.entries.map((entry) => <CalendarEntryItem key={entry.id} entry={entry} taskById={taskById} onOpenTask={onOpenTask} />)}</div>
        </section>) : <p className="agenda-empty">Nenhum prazo, previsão ou marco neste mês.</p>}
      </div>}
      <footer className="calendar-legend"><span><i className="deadline" />Prazo</span><span><i className="forecast" />Previsão</span><span><i className="milestone" />Marco</span></footer>
    </section>
  </>
}

function CalendarEntryItem({ entry, taskById, onOpenTask }: { entry: CalendarEntry; taskById: Map<string, Task>; onOpenTask: (task: Task) => void }) {
  const Icon = entry.kind === 'milestone' ? Flag : entry.kind === 'forecast' ? Target : CalendarBlank
  const task = entry.taskId ? taskById.get(entry.taskId) : undefined
  return task
    ? <button className={`calendar-entry ${entry.kind}`} style={{ '--project-color': entry.color } as React.CSSProperties} onClick={() => onOpenTask(task)} title={`${entry.project}: ${entry.title}`}><Icon size={12} /><span>{entry.title}</span></button>
    : <span className={`calendar-entry ${entry.kind}`} style={{ '--project-color': entry.color } as React.CSSProperties} title={`${entry.project}: ${entry.title}`}><Icon size={12} /><span>{entry.title}</span></span>
}
