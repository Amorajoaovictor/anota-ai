import { describe, expect, it } from 'vitest'
import { buildRoadmapWeek, groupMilestonesByRoadmapDay, groupTasksByRoadmapDay } from './roadmap'
import type { Milestone, Task } from './domain'

const makeTask = (id: string, due?: string, priority: Task['priority'] = 'P1'): Task => ({
  id,
  title: `Demanda ${id}`,
  project: 'VistaFor',
  status: 'Backlog',
  priority,
  due,
  color: '#68d7a7',
})

describe('Roadmap semanal', () => {
  it('mantém quatro demandas do mesmo dia em cards separados, sem limitar a uma por período', () => {
    const days = buildRoadmapWeek(new Date(2026, 6, 24))
    const tasks = [
      makeTask('1', '24/07'),
      makeTask('2', '24/07'),
      makeTask('3', '24/07'),
      makeTask('4', '24/07'),
    ]

    const result = groupTasksByRoadmapDay(tasks, days)
    const friday = result.days.find((day) => day.key === '24/07')

    expect(friday?.tasks.map((task) => task.id)).toEqual(['1', '2', '3', '4'])
    expect(new Set(friday?.tasks.map((task) => task.id)).size).toBe(4)
  })

  it('ordena o dia por prioridade, já que o card não tem horário', () => {
    const days = buildRoadmapWeek(new Date(2026, 6, 24))
    const result = groupTasksByRoadmapDay([
      makeTask('baixa', '24/07', 'P3'),
      makeTask('critica', '24/07', 'P0'),
      makeTask('media', '24/07', 'P2'),
    ], days)

    expect(result.days.find((day) => day.key === '24/07')?.tasks.map((task) => task.id))
      .toEqual(['critica', 'media', 'baixa'])
  })

  it('preserva demandas sem prazo em uma fila separada', () => {
    const days = buildRoadmapWeek(new Date(2026, 6, 24))
    const result = groupTasksByRoadmapDay([
      makeTask('dated', '24/07'),
      makeTask('undated'),
    ], days)

    expect(result.unscheduled.map((task) => task.id)).toEqual(['undated'])
    expect(result.days.flatMap((day) => day.tasks).map((task) => task.id)).toEqual(['dated'])
  })

  it('posiciona marcos pela data completa e preserva marco sem tarefas vinculadas', () => {
    const days = buildRoadmapWeek(new Date(2026, 6, 24))
    const milestones: Milestone[] = [{
      id: 'milestone-empty',
      name: 'Entrega sem tarefas',
      project: 'VistaFor',
      targetDate: '2026-07-24',
      status: 'Planejado',
      description: 'Checkpoint independente.',
      color: '#68d7a7',
    }]

    const result = groupMilestonesByRoadmapDay(milestones, days)

    expect(result.find((day) => day.key === '24/07')?.milestones.map((item) => item.id)).toEqual(['milestone-empty'])
  })
})
