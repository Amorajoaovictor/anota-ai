import { priorities, type Milestone, type Task } from './domain'

const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export type RoadmapDay = {
  date: Date
  key: string
  weekday: string
  day: number
  month: string
  isToday: boolean
}

export type RoadmapDayWithTasks = RoadmapDay & { tasks: Task[] }
export type RoadmapDayWithMilestones = RoadmapDay & { milestones: Milestone[] }

export function buildRoadmapWeek(anchor: Date, today = new Date()): RoadmapDay[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekday: weekdays[date.getDay()],
      day: date.getDate(),
      month: months[date.getMonth()],
      isToday: isSameDay(date, today),
    }
  })
}

export function groupTasksByRoadmapDay(tasks: Task[], days: RoadmapDay[]): {
  days: RoadmapDayWithTasks[]
  unscheduled: Task[]
} {
  const dayKeys = new Set(days.map((day) => day.key))
  const scheduled = new Map(days.map((day) => [day.key, [] as Task[]]))

  tasks.forEach((task) => {
    if (task.due && dayKeys.has(task.due)) scheduled.get(task.due)?.push(task)
  })

  return {
    days: days.map((day) => ({
      ...day,
      // Sem horário no card, o dia é ordenado pela prioridade e depois pelo título.
      tasks: [...(scheduled.get(day.key) ?? [])].sort((left, right) =>
        priorities.indexOf(left.priority) - priorities.indexOf(right.priority)
        || left.title.localeCompare(right.title)),
    })),
    unscheduled: tasks.filter((task) => !task.due),
  }
}

export function groupMilestonesByRoadmapDay(milestones: Milestone[], days: RoadmapDay[]): RoadmapDayWithMilestones[] {
  const scheduled = new Map(days.map((day) => [day.key, [] as Milestone[]]))
  milestones.forEach((milestone) => {
    const date = parseIsoDate(milestone.targetDate)
    if (!date) return
    const key = milestone.targetDate
    scheduled.get(key)?.push(milestone)
  })
  return days.map((day) => ({
    ...day,
    milestones: [...(scheduled.get(day.key) ?? [])],
  }))
}

export function formatRoadmapWeekRange(days: RoadmapDay[]): string {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return ''
  if (first.month === last.month) return `${first.day}–${last.day} ${first.month} ${last.date.getFullYear()}`
  return `${first.day} ${first.month}–${last.day} ${last.month} ${last.date.getFullYear()}`
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export type RoadmapScale = 'days' | 'weeks'
export type RoadmapColumn = RoadmapDay & { endKey: string; endDate: Date }

export function shiftRoadmapDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Calendar arithmetic (not milliseconds) keeps local dates stable across DST. */
export function buildRoadmapTimeline(anchor: Date, scale: RoadmapScale, count: number, today = new Date()): RoadmapColumn[] {
  const start = scale === 'weeks' ? buildRoadmapWeek(anchor, today)[0].date : anchor
  const step = scale === 'weeks' ? 7 : 1
  return Array.from({ length: count }, (_, index) => {
    const date = shiftRoadmapDate(start, index * step)
    const endDate = shiftRoadmapDate(date, step - 1)
    const key = dateKey(date)
    const endKey = dateKey(endDate)
    return { date, endDate, key, endKey, day: date.getDate(), month: months[date.getMonth()], weekday: weekdays[date.getDay()], isToday: dateKey(today) >= key && dateKey(today) <= endKey }
  })
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function groupRoadmapTimeline(tasks: Task[], milestones: Milestone[], columns: RoadmapColumn[]) {
  const grouped = columns.map(column => ({ ...column, tasks: [] as Task[], milestones: [] as Milestone[] }))
  // One index per day. Bounded rendered window, regardless of historical span.
  const byDay = new Map<string, typeof grouped[number]>()
  grouped.forEach(column => {
    for (let date = column.date; date <= column.endDate; date = shiftRoadmapDate(date, 1)) byDay.set(dateKey(date), column)
  })
  tasks.forEach(task => { if (task.due) byDay.get(task.due)?.tasks.push(task) })
  milestones.forEach(milestone => byDay.get(milestone.targetDate)?.milestones.push(milestone))
  grouped.forEach(column => column.tasks.sort((a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority) || a.title.localeCompare(b.title)))
  return { columns: grouped, unscheduled: tasks.filter(task => !task.due) }
}
