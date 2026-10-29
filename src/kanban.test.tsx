import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KanbanView } from './kanban'
import { endDrag, getDragItem, startDrag } from './dnd'
import { initialState, taskStatuses } from './domain'
import type { ProjectActions } from './lib/store'

// Protect status integrity: browsing must not write; only an explicit drop may
// move a task, once. Cancellation and ordinary scrolling must preserve work.
afterEach(() => { endDrag(); vi.useRealTimers(); vi.restoreAllMocks() })
function setup(saveFails = false) {
  const state = structuredClone(initialState)
  state.tasks = [{ id: 'task-1', title: 'Revisar plano de testes', project: 'VistaFor', status: 'Backlog', priority: 'P1', color: '#79dfb2' }]
  state.milestones = []
  const moveTask = vi.fn().mockResolvedValue(saveFails ? undefined : {}), onOpen = vi.fn(), onCreateTask = vi.fn()
  render(<KanbanView state={state} scope={{ type: 'global' }} actions={{ moveTask } as unknown as ProjectActions} onOpen={onOpen} onStatusChange={vi.fn()} onCreateTask={onCreateTask} />)
  return { moveTask, onOpen, onCreateTask }
}
function pointer(element: Element, type: string, x = 100, y = 300) {
  fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }), { pointerType: 'touch', pointerId: 1 }))
}
function target(status: string) { return screen.getByRole('button', { name: `Exibir ${status}` }) }
function card() { return screen.getAllByText('Revisar plano de testes').map(element => element.closest('article')).find(Boolean)! }
function hit(element: Element | null) { Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => element }) }
function hold() { pointer(card(), 'pointerdown'); act(() => { vi.advanceTimersByTime(350) }) }

describe('Kanban: status no topo do celular', () => {
  it('seleciona coluna sem alterar status e cria na coluna selecionada', () => {
    const { moveTask, onCreateTask } = setup()
    fireEvent.click(target('Bloqueada'))
    expect(target('Bloqueada')).toHaveAttribute('aria-pressed', 'true')
    expect(moveTask).not.toHaveBeenCalled()
    const column = document.querySelector('.kanban-column[data-mobile-selected="true"]')!
    fireEvent.click(column.querySelector('button')!)
    expect(onCreateTask).toHaveBeenCalledWith({ status: 'Bloqueada', milestoneIds: [] })
  })
  it.each(taskStatuses.filter(status => status !== 'Backlog'))('soltar por toque em %s grava uma vez, sem abrir card', async status => {
    vi.useFakeTimers()
    const { moveTask, onOpen } = setup()
    const source = card(), destination = target(status)
    hit(destination)
    hold(); pointer(source, 'pointermove', 160, 100)
    expect(destination).toHaveClass('touch-drop-over')
    await act(async () => { pointer(source, 'pointerup', 160, 100) })
    pointer(source, 'pointerup', 160, 100)
    fireEvent.click(source)
    expect(moveTask).toHaveBeenCalledExactlyOnceWith('task-1', status, undefined)
    expect(onOpen).not.toHaveBeenCalled()
    expect(getDragItem()).toBeNull()
    expect(destination).toHaveAttribute('aria-pressed', 'true')
  })
  it.each(['pointercancel', 'lostpointercapture'])('cancelar com %s mantém status', event => {
    vi.useFakeTimers()
    const { moveTask } = setup()
    hit(target('Em andamento'))
    hold(); pointer(card(), 'pointermove', 160, 100); pointer(card(), event); pointer(card(), 'pointerup', 160, 100)
    expect(moveTask).not.toHaveBeenCalled()
    expect(getDragItem()).toBeNull()
  })
  it('rolar antes de segurar, tocar ou soltar fora de um destino não move', () => {
    vi.useFakeTimers()
    const { moveTask, onOpen } = setup()
    hit(target('Em andamento'))
    pointer(card(), 'pointerdown'); pointer(card(), 'pointermove', 100, 250)
    act(() => { vi.advanceTimersByTime(400) })
    pointer(card(), 'pointerup', 100, 250)
    expect(getDragItem()).toBeNull()
    pointer(card(), 'pointerdown'); pointer(card(), 'pointerup'); fireEvent.click(card())
    expect(onOpen).toHaveBeenCalledOnce()
    hit(null); hold(); pointer(card(), 'pointermove', 160, 100); pointer(card(), 'pointerup', 160, 100)
    expect(moveTask).not.toHaveBeenCalled()
  })
  it('bloqueia rolagem nativa só durante arraste ativo', () => {
    vi.useFakeTimers()
    setup()
    const before = new Event('touchmove', { bubbles: true, cancelable: true })
    fireEvent(card(), before)
    expect(before.defaultPrevented).toBe(false)
    hold()
    const during = new Event('touchmove', { bubbles: true, cancelable: true })
    fireEvent(card(), during)
    expect(during.defaultPrevented).toBe(true)
    pointer(card(), 'pointercancel')
    const after = new Event('touchmove', { bubbles: true, cancelable: true })
    fireEvent(card(), after)
    expect(after.defaultPrevented).toBe(false)
  })
  it('ignora mesma coluna e tipos de arraste que não são tarefas', () => {
    const { moveTask } = setup()
    startDrag({ type: 'task', id: 'task-1', from: 'Backlog' }); fireEvent.drop(target('Backlog')); endDrag()
    startDrag({ type: 'note', id: 'note-1', from: 'Notas' }); fireEvent.drop(target('Em andamento'))
    expect(moveTask).not.toHaveBeenCalled()
  })
  it('falha ao salvar mantém coluna de origem acessível', async () => {
    vi.useFakeTimers()
    setup(true)
    hit(target('Em andamento'))
    hold(); pointer(card(), 'pointermove', 160, 100)
    await act(async () => { pointer(card(), 'pointerup', 160, 100) })
    expect(target('Backlog')).toHaveAttribute('aria-pressed', 'true')
  })
  it('preserva arraste desktop e reordenação dentro da coluna', () => {
    const { moveTask } = setup()
    startDrag({ type: 'task', id: 'other-task', from: 'Backlog' }); fireEvent.drop(card())
    expect(moveTask).toHaveBeenCalledExactlyOnceWith('other-task', 'Backlog', 'task-1')
  })
})

