import type { Meeting, Task } from './domain'

export const REMINDER_TIMEZONE = 'America/Sao_Paulo'
export type TodayReminder = {
  id: string
  kind: 'meeting' | 'task'
  title: string
  detail: string
  task?: Task
}

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: REMINDER_TIMEZONE, hour: '2-digit', minute: '2-digit' })
function dateKey(date: Date): string {
  const parts = dateFormat.formatToParts(date)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

/** Prazos são datas civis; reuniões são instantes convertidos para o dia de São Paulo. */
export function buildTodayReminders(tasks: Task[], meetings: Meeting[], now: Date): TodayReminder[] {
  const today = dateKey(now)
  const meetingReminders: TodayReminder[] = meetings
    .filter((meeting) => {
      const start = new Date(meeting.startsAt)
      return Number.isFinite(start.getTime()) && dateKey(start) === today
    })
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .map((meeting) => ({
      id: `meeting:${meeting.id}`, kind: 'meeting', title: meeting.title,
      detail: `Reunião hoje às ${timeFormat.format(new Date(meeting.startsAt))}${meeting.project ? ` · ${meeting.project}` : ''}`,
    }))
  const taskReminders: TodayReminder[] = tasks
    .filter((task) => task.due === today && task.status !== 'Concluída' && task.status !== 'Cancelada')
    .map((task) => ({ id: `task:${task.id}`, kind: 'task', title: task.title, detail: `Vence hoje · ${task.project}`, task }))
  return [...meetingReminders, ...taskReminders]
}
