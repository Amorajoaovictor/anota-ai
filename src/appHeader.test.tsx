import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { initialState } from './domain'
vi.mock('./lib/auth/client', () => ({ authClient: { signOut: vi.fn() } }))

// Header controls must remain identifiable and actionable when mobile CSS
// hides their labels. Losing search blocks access to tasks and projects.
describe('Cabeçalho: ações acessíveis', () => {
  it('abre busca pelo nome acessível mesmo sem texto visível', () => {
    render(<App initialState={structuredClone(initialState)} user={{ id: 'test', name: 'Teste', email: null }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar tarefas e projetos' }))
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument()
  })
  it('abre criação de tarefa pela ação do cabeçalho', () => {
    render(<App initialState={structuredClone(initialState)} user={{ id: 'test', name: 'Teste', email: null }} />)
    fireEvent.click(screen.getByTitle('Nova tarefa (N)'))
    expect(screen.getByRole('dialog', { name: 'Nova tarefa' })).toBeInTheDocument()
  })
})
