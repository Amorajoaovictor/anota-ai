import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { initialState } from './domain'
vi.mock('./lib/auth/client', () => ({ authClient: { signOut: vi.fn() } }))
const user = { id: 'test', name: 'Teste', email: null }
afterEach(() => window.history.replaceState(null, '', '/'))

// Perder seção ao recarregar/voltar impede compartilhar páginas de trabalho.
describe('Navegação por URL', () => {
  it('abre diretamente uma seção global', () => {
    window.history.replaceState(null, '', '/kanban')
    render(<App initialState={structuredClone(initialState)} user={user} initialRoute={{ kind: 'global', section: 'Kanban' }} />)
    expect(screen.getAllByRole('link', { name: 'Kanban' })[0]).toHaveAttribute('aria-current', 'page')
  })
  it('atualiza URL e restaura seção em voltar/avançar', () => {
    render(<App initialState={structuredClone(initialState)} user={user} />)
    fireEvent.click(screen.getAllByRole('link', { name: 'Kanban' })[0]!)
    expect(window.location.pathname).toBe('/kanban')
    window.history.replaceState(null, '', '/notas')
    fireEvent.popState(window)
    expect(screen.getAllByRole('link', { name: 'Notas' })[0]).toHaveAttribute('aria-current', 'page')
    window.history.replaceState(null, '', '/kanban')
    fireEvent.popState(window)
    expect(screen.getAllByRole('link', { name: 'Kanban' })[0]).toHaveAttribute('aria-current', 'page')
  })
  it('mantém projeto na URL ao trocar abas e oferece links copiáveis', () => {
    render(<App initialState={structuredClone(initialState)} user={user} initialRoute={{ kind: 'project', projectId: 'vistafor', section: 'Visão geral' }} />)
    const tabs = screen.getByRole('navigation', { name: 'Seções de VistaFor' })
    const kanban = within(tabs).getByRole('link', { name: 'Kanban' })
    expect(kanban).toHaveAttribute('href', '/projetos/vistafor/kanban')
    fireEvent.click(kanban)
    expect(window.location.pathname).toBe('/projetos/vistafor/kanban')
    expect(kanban).toHaveAttribute('aria-current', 'page')
  })
  it('preserva navegação nativa para abrir outra aba', () => {
    render(<App initialState={structuredClone(initialState)} user={user} />)
    document.addEventListener('click', (event) => {
      expect(event.defaultPrevented).toBe(false)
      event.preventDefault() // jsdom não implementa abertura de outra aba.
    }, { once: true })
    fireEvent.click(screen.getAllByRole('link', { name: 'Kanban' })[0]!, { ctrlKey: true })
    expect(window.location.pathname).toBe('/')
  })
})
