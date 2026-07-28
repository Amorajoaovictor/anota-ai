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
      key: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
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
    const key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
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
