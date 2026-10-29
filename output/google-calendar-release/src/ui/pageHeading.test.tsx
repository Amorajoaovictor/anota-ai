import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeading } from './pageHeading'

describe('PageHeading', () => {
  it('level page mostra o eyebrow quando fornecido', () => {
    render(<PageHeading level="page" eyebrow="PROJETO" title="VistaFor" />)
    expect(screen.getByText('PROJETO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'VistaFor' })).toBeInTheDocument()
  })

  it('level page sem eyebrow não renderiza o rótulo', () => {
    render(<PageHeading level="page" title="Hoje" />)
    expect(screen.queryByText('PROJETO')).not.toBeInTheDocument()
  })

  it('level section também renderiza o eyebrow quando fornecido, de forma compacta', () => {
    render(<PageHeading level="section" eyebrow="PROJETO" title="Contexto" />)
    expect(screen.getByText('PROJETO')).toHaveClass('eyebrow-inline')
    expect(screen.getByRole('heading', { name: 'Contexto' })).toBeInTheDocument()
  })

  it('level section sem eyebrow não renderiza o rótulo', () => {
    render(<PageHeading level="section" title="Kanban" />)
    expect(screen.queryByText('PROJETO')).not.toBeInTheDocument()
  })

  it('level section usa a classe compacta', () => {
    render(<PageHeading level="section" title="Kanban" />)
    expect(screen.getByRole('heading', { name: 'Kanban' }).closest('.page-heading')).toHaveClass('section-heading-compact')
  })

  it('renderiza o subtítulo e a ação', () => {
    render(<PageHeading title="Marcos" subtitle="Pontos-chave" action={<button>Novo marco</button>} />)
    expect(screen.getByText('Pontos-chave')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo marco' })).toBeInTheDocument()
  })

  it('acrescenta className extra sem substituir as classes base', () => {
    render(<PageHeading title="Caixa" className="context-heading" />)
    const wrapper = screen.getByRole('heading', { name: 'Caixa' }).closest('.page-heading')
    expect(wrapper).toHaveClass('page-heading', 'section-heading', 'context-heading')
  })
})
