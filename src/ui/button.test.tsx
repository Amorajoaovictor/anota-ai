import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renderiza o rótulo e aplica a classe da variante', () => {
    render(<Button variant="primary">Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toHaveClass('primary-button')
  })

  it('usa ghost-button como variante padrão', () => {
    render(<Button>Cancelar</Button>)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('ghost-button')
  })

  it('aplica danger-button e a classe de tamanho sm', () => {
    render(<Button variant="danger" size="sm">Remover</Button>)
    const button = screen.getByRole('button', { name: 'Remover' })
    expect(button).toHaveClass('danger-button')
    expect(button).toHaveClass('ui-button-sm')
  })

  it('dispara onClick quando clicado', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Ok' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('não dispara onClick quando desabilitado', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Ok</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Ok' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('preserva className adicional junto da variante', () => {
    render(<Button className="project-archive">Arquivar</Button>)
    const button = screen.getByRole('button', { name: 'Arquivar' })
    expect(button).toHaveClass('ghost-button')
    expect(button).toHaveClass('project-archive')
  })
})
