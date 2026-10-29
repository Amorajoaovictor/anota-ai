import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, PriorityPill, StatusPill, TagChips } from './badge'

describe('Badge', () => {
  it('aplica a classe de tom pedida', () => {
    render(<Badge tone="danger">Erro</Badge>)
    expect(screen.getByText('Erro')).toHaveClass('ui-badge', 'ui-badge-danger')
  })

  it('usa neutral como tom padrão', () => {
    render(<Badge>Padrão</Badge>)
    expect(screen.getByText('Padrão')).toHaveClass('ui-badge-neutral')
  })
})

describe('PriorityPill', () => {
  it('mapeia P0 para o tom danger', () => {
    render(<PriorityPill priority="P0" />)
    expect(screen.getByText('P0')).toHaveClass('ui-badge-danger')
  })

  it('mapeia P3 para o tom neutral', () => {
    render(<PriorityPill priority="P3" />)
    expect(screen.getByText('P3')).toHaveClass('ui-badge-neutral')
  })
})

describe('StatusPill', () => {
  it('gera a classe kebab a partir do status', () => {
    render(<StatusPill status="Em andamento" />)
    const pill = screen.getByText('Em andamento')
    expect(pill).toHaveClass('status-pill', 'em-andamento')
  })
})

describe('TagChips', () => {
  it('renderiza um chip por etiqueta', () => {
    render(<TagChips tags={[{ id: '1', name: 'raster', color: '#79dfb2' }, { id: '2', name: 'CEGEO', color: '#f0ad5b' }]} />)
    expect(screen.getByText('raster')).toBeInTheDocument()
    expect(screen.getByText('CEGEO')).toBeInTheDocument()
  })

  it('mostra o texto vazio quando não há etiquetas', () => {
    render(<TagChips tags={[]} empty="—" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('não renderiza nada sem etiquetas nem texto vazio', () => {
    const { container } = render(<TagChips tags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
