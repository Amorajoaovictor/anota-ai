import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationBell } from './notificationBell'
import type { Task } from './domain'

const task: Task = { id: 'card-1', title: 'Entregar relatório', project: 'Observa', color: '#64a3ff', priority: 'P1', status: 'Backlog', due: '2026-10-05' }
const props = () => ({ tasks: [task], meetings: [{ id: 'meeting-1', title: 'Reunião equipe', description: '', startsAt: '2026-10-05T12:00:00Z', timezone: 'America/Sao_Paulo' }], pendingReviewCount: 2, onOpenTask: vi.fn(), onOpenMeetings: vi.fn(), onOpenInbox: vi.fn() })
afterEach(() => vi.useRealTimers())

describe('sino de notificações', () => {
  it('conta lembretes e revisões, abre painel e navega para card, reuniões e caixa de entrada', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T15:00:00Z'))
    const callbacks = props()
    render(<NotificationBell {...callbacks} />)
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Notificações, 4 pendentes' }))
    open()
    expect(screen.getByRole('dialog', { name: 'Notificações' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Entregar relatório/ }))
    expect(callbacks.onOpenTask).toHaveBeenCalledWith(task)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    open(); fireEvent.click(screen.getByRole('button', { name: /Reunião equipe/ }))
    expect(callbacks.onOpenMeetings).toHaveBeenCalledOnce()
    open(); fireEvent.click(screen.getByRole('button', { name: /2 revisões pendentes/ }))
    expect(callbacks.onOpenInbox).toHaveBeenCalledOnce()
  })

  it('atualiza contador quando card é concluído sem recarregar página', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T15:00:00Z'))
    const callbacks = { ...props(), meetings: [], pendingReviewCount: 0 }
    const { rerender } = render(<NotificationBell {...callbacks} />)
    expect(screen.getByRole('button', { name: 'Notificações, 1 pendentes' })).toBeInTheDocument()
    rerender(<NotificationBell {...callbacks} tasks={[{ ...task, status: 'Concluída' }]} />)
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument()
  })

  it('troca lembretes automaticamente na meia-noite de São Paulo', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T02:59:45Z'))
    render(<NotificationBell {...props()} pendingReviewCount={0} />)
    expect(screen.getByRole('button', { name: 'Notificações, 2 pendentes' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(30_000))
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(screen.getByText('Nenhum lembrete para hoje.')).toBeInTheDocument()
    expect(screen.queryByText('Entregar relatório')).not.toBeInTheDocument()
  })
  it('mostra estado vazio sem contador e fecha com Escape', () => {
    render(<NotificationBell {...props()} tasks={[]} meetings={[]} pendingReviewCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(screen.getByText('Nenhum lembrete para hoje.')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
