import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContextReviewQueue } from './contextFlow'
import type { AppState } from './domain'
import type { ProjectActions } from './lib/store'
import type { AiPlan } from './server/ai/plan'

const plan: AiPlan = {
  summary: 'Uma tarefa com prazo e um fato importante sobre sua complexidade.',
  confidence: 91,
  evidence: ['O áudio cita prazo e dificuldade percebida.'],
  actions: [
    {
      id: 'task-1',
      operation: 'create',
      entity: 'task',
      dependsOn: [],
      confidence: 94,
      evidence: ['Trecho descreve uma entrega concreta.'],
      data: {
        project: { existingId: 'project-1' },
        title: 'Preparar relatório',
        description: 'Relatório parece mais complexo que o previsto.',
        complexity: 3,
        dueAt: '2026-08-05T00:00:00.000Z',
      },
    },
    {
      id: 'context-1',
      operation: 'create',
      entity: 'context',
      dependsOn: ['task-1'],
      confidence: 89,
      evidence: ['A percepção de complexidade deve acompanhar a tarefa.'],
      data: {
        project: { existingId: 'project-1' },
        task: { actionId: 'task-1' },
        category: 'FACT',
        title: 'Complexidade percebida',
        content: 'O relatório parece mais complexo que o previsto.',
      },
    },
  ],
}

const state: AppState = {
  projects: [{ id: 'project-1', name: 'Observa', description: '', color: '#64a3ff', progress: 0, priority: 'P1', aliases: [], modules: [], tags: [], archived: false }],
  tasks: [],
  actionPlan: [],
  milestones: [],
  notes: [],
  contexts: [],
  activity: [],
  inbox: [{
    id: 'inbox-1',
    source: 'Áudio',
    status: 'Aguardando confirmação',
    date: 'agora',
    text: 'Preciso preparar o relatório até dia cinco. Parece mais complexo que o previsto.',
    suggestion: plan,
  }],
}

describe('fluxo intermediário das informações extraídas', () => {
  it('obriga revisar fatos antes de liberar a aprovação do plano e preserva correções', async () => {
    const confirmInbox = vi.fn()
    const actions = {
      refreshInbox: vi.fn(),
      confirmInbox,
      discardInbox: vi.fn(),
    } as unknown as ProjectActions

    render(<ContextReviewQueue state={state} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Revisar proposta/i }))

    expect(screen.getByRole('heading', { name: 'Informações extraídas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar plano' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Prazo citado')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Complexidade percebida')).toHaveValue('3')

    const title = screen.getByLabelText('Título da tarefa')
    await userEvent.clear(title)
    await userEvent.type(title, 'Preparar relatório final')
    await userEvent.click(screen.getByRole('button', { name: 'Transformar em proposta' }))

    expect(screen.getByRole('heading', { name: 'Revise o plano completo' })).toBeInTheDocument()
    expect(screen.getByText('Preparar relatório final')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar plano' }))
    expect(confirmInbox).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      actions: expect.arrayContaining([expect.objectContaining({
        id: 'task-1',
        data: expect.objectContaining({ title: 'Preparar relatório final' }),
      })]),
    }))
  })
})
