import { describe, expect, it } from 'vitest'
import { buildAgendaEntries, buildCalendarMonth, groupCalendarEntries } from './calendar'
import type { Milestone, Task } from './domain'

const task = (id: string, due?: string, forecast?: string): Task => ({
  id,
  title: `Tarefa ${id}`,
  project: 'Observa',
  status: 'Em andamento',
  priority: 'P1',
  due,
  forecast,
  color: '#68d7a7',
})

describe('agenda mensal', () => {
  it('posiciona prazo e previsão por data completa, sem misturar anos', () => {
    const days = buildCalendarMonth(new Date(2026, 6, 1))
    const entries = groupCalendarEntries([
      task('prazo-2026', '2026-07-24'),
      task('previsao-2027', undefined, '2027-07-24'),
    ], [], days)

    expect(entries.get('2026-07-24')?.map((entry) => entry.id)).toEqual(['task:deadline:prazo-2026'])
    expect(entries.get('2026-07-24')?.[0]).toMatchObject({ kind: 'deadline', title: 'Tarefa prazo-2026' })
    expect(entries.get('2026-07-24')?.some((entry) => entry.id === 'task:forecast:previsao-2027')).toBe(false)
  })

  it('inclui marco na data alvo e completa grade com semanas inteiras', () => {
    const days = buildCalendarMonth(new Date(2026, 6, 1))
    const milestones: Milestone[] = [{
      id: 'm-1', name: 'Homologação', project: 'Observa', targetDate: '2026-07-24',
      status: 'Planejado', description: '', color: '#68d7a7',
    }]

    const entries = groupCalendarEntries([], milestones, days)

    expect(days).toHaveLength(35)
    expect(days[0]?.date).toBe('2026-06-28')
    expect(days.at(-1)?.date).toBe('2026-08-01')
    expect(entries.get('2026-07-24')).toMatchObject([{ id: 'milestone:m-1', kind: 'milestone', title: 'Homologação' }])
  })

  it('ordena agenda por dia e mantém tarefa editável ligada à origem', () => {
    const days = buildCalendarMonth(new Date(2026, 6, 1))
    const entries = groupCalendarEntries([
      task('fim', '2026-07-30'),
      task('inicio', '2026-07-03'),
    ], [], days)

    expect(buildAgendaEntries(days, entries)).toEqual([
      { date: '2026-07-03', entries: [expect.objectContaining({ taskId: 'inicio' })] },
      { date: '2026-07-30', entries: [expect.objectContaining({ taskId: 'fim' })] },
    ])
  })
})
