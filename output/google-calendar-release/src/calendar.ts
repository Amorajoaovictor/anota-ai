import type { Milestone, Task } from './domain'

const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export type CalendarDay = {
  date: string
  day: number
  weekday: string
  inMonth: boolean
  isToday: boolean
}

export type CalendarEntry = {
  id: string
  kind: 'deadline' | 'forecast' | 'milestone'
  title: string
  project: string
  color: string
  taskId?: string
}

export function buildCalendarMonth(anchor: Date, today = new Date()): CalendarDay[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const end = new Date(last)
  end.setDate(last.getDate() + (6 - last.getDay()))

  const days: CalendarDay[] = []
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push({
      date: toDateKey(date),
      day: date.getDate(),
      weekday: weekdays[date.getDay()]!,
      inMonth: date.getMonth() === anchor.getMonth(),
      isToday: sameDay(date, today),
    })
  }
  return days
}

export function groupCalendarEntries(tasks: Task[], milestones: Milestone[], days: CalendarDay[]): Map<string, CalendarEntry[]> {
  const supportedDates = new Set(days.map((day) => day.date))
  const result = new Map<string, CalendarEntry[]>()
  const add = (date: string | undefined, entry: CalendarEntry) => {
    if (!date || !supportedDates.has(date)) return
    const current = result.get(date) ?? []
    current.push(entry)
    result.set(date, current)
  }

  tasks.filter((task) => task.status !== 'Concluída' && task.status !== 'Cancelada').forEach((task) => {
    add(task.due, { id: `task:deadline:${task.id}`, kind: 'deadline', title: task.title, project: task.project, color: task.color, taskId: task.id })
    if (task.forecast !== task.due) {
      add(task.forecast, { id: `task:forecast:${task.id}`, kind: 'forecast', title: task.title, project: task.project, color: task.color, taskId: task.id })
    }
  })
  milestones.filter((milestone) => milestone.status !== 'Cancelado').forEach((milestone) => {
    add(milestone.targetDate, { id: `milestone:${milestone.id}`, kind: 'milestone', title: milestone.name, project: milestone.project, color: milestone.color })
  })

  result.forEach((entries) => entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.title.localeCompare(right.title)))
  return result
}

export function buildAgendaEntries(days: CalendarDay[], entries: Map<string, CalendarEntry[]>): Array<{ date: string; entries: CalendarEntry[] }> {
  return days
    .filter((day) => day.inMonth && entries.has(day.date))
    .map((day) => ({ date: day.date, entries: entries.get(day.date)! }))
}

export function formatCalendarMonth(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}
