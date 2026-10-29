import { describe, expect, it } from 'vitest'
import { buildRoadmapTimeline, groupRoadmapTimeline } from './roadmap'
import type { Task } from './domain'

// Protect real deadlines and history: exploring or regrouping must never lose,
// duplicate, or reschedule work, particularly at month/year boundaries.
const task = (id: string, due?: string): Task => ({ id, due, title: id, project: 'VistaFor', color: '#68d7a7', status: 'Concluída', priority: 'P2', milestoneIds: ['delivery'] })

describe('Timeline contínua', () => {
  it('atravessa meses e anos mantendo chaves ISO completas', () => {
    const columns = buildRoadmapTimeline(new Date(2026, 11, 30), 'days', 5, new Date(2027, 0, 1))
    expect(columns.map(column => column.key)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
    expect(columns.filter(column => column.isToday).map(column => column.key)).toEqual(['2027-01-01'])
  })

  it('agrupa semana de virada do ano sem perdas nem duplicações', () => {
    const tasks = [task('past', '2026-12-28'), task('year-end', '2026-12-31'), task('future', '2027-01-03'), task('next', '2027-01-04'), task('undated')]
    const before = structuredClone(tasks)
    const result = groupRoadmapTimeline(tasks, [], buildRoadmapTimeline(new Date(2026, 11, 30), 'weeks', 2))
    expect(result.columns[0].tasks.map(item => item.id)).toEqual(['future', 'past', 'year-end'])
    expect(result.columns[1].tasks.map(item => item.id)).toEqual(['next'])
    expect(result.unscheduled.map(item => item.id)).toEqual(['undated'])
    expect(new Set(result.columns.flatMap(column => column.tasks.map(item => item.id))).size).toBe(4)
    expect(tasks).toEqual(before)
  })

  it('mantém marco independente e vínculos de tarefas na mesma semana', () => {
    const milestone = { id: 'delivery', name: 'Entrega', project: 'VistaFor', targetDate: '2027-01-01', color: '#68d7a7', status: 'Planejado' as const, description: '' }
    const result = groupRoadmapTimeline([task('linked', '2026-12-31')], [milestone], buildRoadmapTimeline(new Date(2026, 11, 30), 'weeks', 1))
    expect(result.columns[0].milestones).toEqual([milestone])
    expect(result.columns[0].tasks[0].milestoneIds).toEqual(['delivery'])
  })
})
