import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './emptyState'

describe('EmptyState', () => {
  it('renderiza título, descrição e ícone', () => {
    render(<EmptyState icon={<svg data-testid="icon" />} title="Nenhum marco" description="Crie o primeiro." />)
    expect(screen.getByText('Nenhum marco')).toBeInTheDocument()
    expect(screen.getByText('Crie o primeiro.')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('usa panel como tamanho padrão', () => {
    render(<EmptyState icon={null} title="Vazio" />)
    expect(screen.getByText('Vazio').closest('.ui-empty')).toHaveAttribute('data-size', 'panel')
  })

  it('aceita o tamanho page', () => {
    render(<EmptyState icon={null} title="Vazio" size="page" />)
    expect(screen.getByText('Vazio').closest('.ui-empty')).toHaveAttribute('data-size', 'page')
  })

  it('renderiza a ação quando fornecida', () => {
    render(<EmptyState icon={null} title="Vazio" action={<button>Criar</button>} />)
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument()
  })
})
