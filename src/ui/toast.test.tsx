import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast, useToast } from './toast'

describe('Toast', () => {
  it('tom success usa role=status e aria-live=polite', () => {
    render(<Toast toast={{ message: 'Salvo', tone: 'success', key: 1 }} onDismiss={() => {}} />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveAttribute('aria-live', 'polite')
    expect(toast).toHaveAttribute('data-tone', 'success')
  })

  it('tom error usa role=alert, aria-live=assertive e botão de fechar', () => {
    render(<Toast toast={{ message: 'Falha ao salvar', tone: 'error', key: 1 }} onDismiss={() => {}} />)
    const toast = screen.getByRole('alert')
    expect(toast).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByRole('button', { name: 'Fechar aviso' })).toBeInTheDocument()
  })

  it('tom info usa role=status, sem botão de fechar', () => {
    render(<Toast toast={{ message: 'Vale só nesta sessão', tone: 'info', key: 1 }} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info')
    expect(screen.queryByRole('button', { name: 'Fechar aviso' })).not.toBeInTheDocument()
  })

  it('não renderiza nada sem toast ativo', () => {
    const { container } = render(<Toast toast={null} onDismiss={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('um segundo aviso não é apagado pelo timer do primeiro', () => {
    const { result } = renderHook(() => useToast())

    act(() => result.current.notify('a'))
    act(() => vi.advanceTimersByTime(1000))
    act(() => result.current.notify('b'))
    act(() => vi.advanceTimersByTime(1500))

    expect(result.current.toast?.message).toBe('b')
  })

  it('erro fica visível por 4500ms e some depois', () => {
    const { result } = renderHook(() => useToast())

    act(() => result.current.notify('Falha ao salvar', 'error'))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.toast).not.toBeNull()

    act(() => vi.advanceTimersByTime(600))
    expect(result.current.toast).toBeNull()
  })

  it('sucesso é o tom padrão quando nenhum é passado', () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.notify('Projeto salvo'))
    expect(result.current.toast?.tone).toBe('success')
  })

  it('dismiss limpa o toast e cancela o timer pendente', () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.notify('Projeto salvo'))
    act(() => result.current.dismiss())
    expect(result.current.toast).toBeNull()
  })
})
