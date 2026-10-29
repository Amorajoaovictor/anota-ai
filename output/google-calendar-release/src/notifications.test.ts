import { describe, expect, it } from 'vitest'
import type { Meeting, Task } from './domain'
import { buildTodayReminders } from './notifications'

const task = (id: string, due?: string, status: Task['status'] = 'Backlog'): Task => ({ id, title: id, project: 'Observa', color: '#64a3ff', priority: 'P1', status, due })
const meeting = (id: string, startsAt: string): Meeting => ({ id, title: id, description: '', timezone: 'America/Sao_Paulo', startsAt })

describe('lembretes de hoje', () => {
  it('inclui apenas prazos de hoje e exclui concluídos, cancelados e previsões', () => {
    const reminders = buildTodayReminders([
      task('hoje', '2026-10-05'), task('ontem', '2026-10-04'), task('amanha', '2026-10-06'),
      task('outro-ano', '2025-10-05'), task('feito', '2026-10-05', 'Concluída'),
      task('cancelado', '2026-10-05', 'Cancelada'), { ...task('previsao'), forecast: '2026-10-05' },
    ], [], new Date('2026-10-05T15:00:00Z'))
    expect(reminders.map((item) => item.id)).toEqual(['task:hoje'])
    expect(reminders[0]?.task?.id).toBe('hoje')
  })

  it('mantém todas as reuniões do dia, inclusive as que já começaram, ordenadas por horário', () => {
    const reminders = buildTodayReminders([], [
      meeting('tarde', '2026-10-05T20:00:00Z'), meeting('cedo', '2026-10-05T11:00:00Z'),
      meeting('amanha', '2026-10-06T12:00:00Z'), meeting('invalida', 'invalid'),
    ], new Date('2026-10-05T15:00:00Z'))
    expect(reminders.map((item) => item.id)).toEqual(['meeting:cedo', 'meeting:tarde'])
    expect(reminders[0]?.detail).toContain('08:00')
  })

  it('usa dia de São Paulo na virada UTC e troca lembretes na meia-noite local', () => {
    const tasks = [task('dia-5', '2026-10-05'), task('dia-6', '2026-10-06')]
    const meetings = [meeting('noite', '2026-10-06T02:30:00Z')]
    expect(buildTodayReminders(tasks, meetings, new Date('2026-10-06T02:59:00Z')).map((item) => item.id)).toEqual(['meeting:noite', 'task:dia-5'])
    expect(buildTodayReminders(tasks, meetings, new Date('2026-10-06T03:00:00Z')).map((item) => item.id)).toEqual(['task:dia-6'])
  })
})
