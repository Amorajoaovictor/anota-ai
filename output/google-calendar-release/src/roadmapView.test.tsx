import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoadmapView } from './roadmapView'
import { endDrag, getDragItem, startDrag } from './dnd'
import { initialState } from './domain'
import type { ProjectActions } from './lib/store'

// Protect the user's confirmed deadlines: timeline navigation must never write;
// only an explicit task drop may schedule it. Keep completed work accessible.
afterEach(() => { endDrag(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function setup() {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 5, 12))
  const state = structuredClone(initialState)
  state.tasks = [{ id: 'history', title: 'Entrega concluída', project: 'VistaFor', status: 'Concluída', priority: 'P1', due: '2026-10-05', color: '#68d7a7' }]
  state.milestones = []
  const updateTask = vi.fn().mockResolvedValue(undefined)
  const onOpen = vi.fn(), onCreateTask = vi.fn()
  render(<RoadmapView state={state} scope={{ type: 'global' }} actions={{ updateTask } as unknown as ProjectActions} notify={vi.fn()} onOpen={onOpen} onCreateTask={onCreateTask} />)
  return { state, updateTask, onOpen, onCreateTask }
}
describe('Roadmap: explorar versus replanejar', () => {
  it('alternar escala e voltar a Hoje preserva contexto e não escreve prazos', () => {
    const { updateTask, onOpen } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Entrega concluída' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semanas' }))
    expect(screen.getByRole('button', { name: 'Semanas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Entrega concluída' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Avançar timeline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dias' }))
    expect(screen.getByRole('button', { name: 'Entrega concluída' })).toBeInTheDocument()
    expect(updateTask).not.toHaveBeenCalled()
  })
  it('cria com data completa e só replaneja por drop explícito', () => {
    const { updateTask, onCreateTask } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa em VistaFor em 2026-10-06' }))
    expect(onCreateTask).toHaveBeenCalledWith({ project: 'VistaFor', due: '2026-10-06' })
    startDrag({ type: 'task', id: 'history', from: '2026-10-05' })
    fireEvent.drop(screen.getByTestId('roadmap-cell-VistaFor-2026-10-06'))
    expect(updateTask).toHaveBeenCalledExactlyOnceWith('history', { due: '2026-10-06' })
  })
  it('filtra por projeto e preserva escopo sem perder tarefas concluídas', () => {
    setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar projetos' }), { target: { value: 'observa' } })
    expect(screen.queryByRole('button', { name: 'Entrega concluída' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar projetos' }), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Entrega concluída' })).toBeInTheDocument()
  })
  it('renova janela de datas ao explorar histórico longo sem escrever ou acumular colunas', () => {
    const { updateTask } = setup()
    const timeline = screen.getByRole('region', { name: /Timeline de tarefas/ })
    for (let index = 0; index < 12; index++) {
      timeline.scrollLeft = 40 * 144
      fireEvent.scroll(timeline)
    }
    expect(document.querySelectorAll('.roadmap-date')).toHaveLength(49)
    expect(document.querySelector('.roadmap-date.today')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(document.querySelector('.roadmap-date.today')).toBeInTheDocument()
    expect(updateTask).not.toHaveBeenCalled()
  })
  it('exploração por teclado e gesto de fundo nunca replaneja tarefa', () => {
    const { updateTask } = setup()
    const timeline = screen.getByRole('region', { name: /Timeline de tarefas/ })
    fireEvent.keyDown(timeline, { key: 'ArrowRight' })
    fireEvent.keyDown(timeline, { key: 'ArrowLeft' })
    fireEvent.keyDown(timeline, { key: 'Home' })
    const before = timeline.scrollLeft
    vi.stubGlobal('PointerEvent', MouseEvent)
    fireEvent.pointerDown(timeline, { button: 0, clientX: 300 })
    fireEvent.pointerMove(timeline, { clientX: 100 })
    fireEvent.pointerUp(timeline)
    expect(timeline.scrollLeft).toBe(before + 200)
    expect(updateTask).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('retorno a Hoje deixa data atual visível em largura de celular', () => {
    // A desktop-sized offset used on a phone would hide today outside the viewport.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(346)
    const { updateTask } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Avançar timeline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    const timeline = screen.getByRole('region', { name: /Timeline de tarefas/ })
    const todayIndex = [...document.querySelectorAll('.roadmap-date')].findIndex(column => column.classList.contains('today'))
    expect(todayIndex * 144).toBeGreaterThanOrEqual(timeline.scrollLeft)
    expect((todayIndex + 1) * 144).toBeLessThanOrEqual(timeline.scrollLeft + 346)
    fireEvent.click(screen.getByRole('button', { name: 'Semanas' }))
    const weekIndex = [...document.querySelectorAll('.roadmap-date')].findIndex(column => column.classList.contains('today'))
    expect(weekIndex * 240).toBeGreaterThanOrEqual(timeline.scrollLeft)
    expect((weekIndex + 1) * 240).toBeLessThanOrEqual(timeline.scrollLeft + 346)
    expect(updateTask).not.toHaveBeenCalled()
  })
  it('soltar na mesma semana mantém prazo original em vez de trocar pela segunda-feira', () => {
    const { updateTask } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Semanas' }))
    startDrag({ type: 'task', id: 'history', from: '2026-10-05' })
    fireEvent.drop(screen.getByTestId('roadmap-cell-VistaFor-2026-10-05'))
    expect(updateTask).not.toHaveBeenCalled()
  })
})

// Protect mobile planning: a finger drop must persist exactly one deadline;
// cancellation, tapping, scrolling, or crossing projects must never reschedule.
function touch(element: Element, type: string, x = 120, y = 150, pointerType = 'touch') {
  fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }), { pointerType, pointerId: 1 }))
}
function hit(element: Element) {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => element })
}
describe('Roadmap: arraste no celular', () => {
  it.each(['touch', 'mouse'])('replaneja com %s no controle de arraste e não abre o card ao soltar', pointerType => {
    const { updateTask, onOpen } = setup()
    const handle = screen.getByRole('button', { name: 'Arrastar Entrega concluída' })
    const destination = screen.getByTestId('roadmap-cell-VistaFor-2026-10-06')
    hit(destination)
    touch(handle, 'pointerdown', 120, 150, pointerType)
    touch(handle, 'pointermove', 210, 150, pointerType)
    expect(destination).toHaveClass('touch-drop-over')
    touch(handle, 'pointerup', 210, 150, pointerType)
    fireEvent.click(handle)
    expect(updateTask).toHaveBeenCalledExactlyOnceWith('history', { due: '2026-10-06' })
    expect(onOpen).not.toHaveBeenCalled()
    expect(getDragItem()).toBeNull()
  })
  it.each(['pointercancel', 'lostpointercapture'])('cancelamento %s preserva prazo', event => {
    const { updateTask } = setup()
    const handle = screen.getByRole('button', { name: 'Arrastar Entrega concluída' })
    hit(screen.getByTestId('roadmap-cell-VistaFor-2026-10-06'))
    touch(handle, 'pointerdown')
    touch(handle, 'pointermove', 210, 150)
    touch(handle, event, 210, 150)
    touch(handle, 'pointerup', 210, 150)
    expect(updateTask).not.toHaveBeenCalled()
    expect(getDragItem()).toBeNull()
  })
  it('ignora toque sem movimento e destino em outro projeto', () => {
    const { updateTask } = setup()
    const handle = screen.getByRole('button', { name: 'Arrastar Entrega concluída' })
    hit(screen.getByTestId('roadmap-cell-VistaFor-2026-10-06'))
    touch(handle, 'pointerdown'); touch(handle, 'pointerup')
    expect(updateTask).not.toHaveBeenCalled()
    hit(screen.getByTestId('roadmap-cell-Observa SEUMA-2026-10-06'))
    touch(handle, 'pointerdown'); touch(handle, 'pointermove', 210, 150); touch(handle, 'pointerup', 210, 150)
    expect(updateTask).not.toHaveBeenCalled()
  })
  it('remove prazo apenas quando solta na faixa Sem data definida', () => {
    const { updateTask } = setup()
    const handle = screen.getByRole('button', { name: 'Arrastar Entrega concluída' })
    touch(handle, 'pointerdown'); touch(handle, 'pointermove', 210, 150)
    hit(screen.getByText('Sem data definida'))
    touch(handle, 'pointerup', 210, 150)
    expect(updateTask).toHaveBeenCalledExactlyOnceWith('history', { due: '' })
  })
  it('rola timeline na borda enquanto segura alça, sem alterar prazo antes de soltar', () => {
    const { updateTask } = setup()
    const timeline = screen.getByRole('region', { name: /Timeline de tarefas/ })
    const before = timeline.scrollLeft
    vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 346, top: 100, bottom: 500, width: 346, height: 400 } as DOMRect)
    hit(screen.getByTestId('roadmap-cell-VistaFor-2026-10-06'))
    const handle = screen.getByRole('button', { name: 'Arrastar Entrega concluída' })
    touch(handle, 'pointerdown'); touch(handle, 'pointermove', 330, 150)
    vi.advanceTimersByTime(34)
    expect(timeline.scrollLeft).toBeGreaterThan(before)
    expect(updateTask).not.toHaveBeenCalled()
    touch(handle, 'pointercancel', 330, 150)
  })
})
