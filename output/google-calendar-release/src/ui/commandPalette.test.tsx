import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { initialState } from '../domain'
import { CommandPalette } from './commandPalette'

const actions = [{ kind: 'action' as const, id: 'new-task', title: 'Nova tarefa', subtitle: 'Atalho N' }]

describe('CommandPalette', () => {
  it('filtra resultados ao digitar', async () => {
    const user = userEvent.setup()
    render(<CommandPalette state={initialState} actions={actions} onClose={() => {}} onSelect={() => {}} />)

    await user.type(screen.getByRole('combobox'), 'VistaFor')

    expect(screen.getAllByText('VistaFor').length).toBeGreaterThan(0)
    expect(screen.queryByText('Intranet')).not.toBeInTheDocument()
  })

  it('seta para baixo duas vezes e Enter seleciona o terceiro resultado', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CommandPalette state={initialState} actions={actions} onClose={() => {}} onSelect={onSelect} />)

    const input = screen.getByRole('combobox')
    await user.type(input, 'vista')
    const optionsBefore = screen.getAllByRole('option')
    const thirdTitle = optionsBefore[2]?.querySelector('b')?.textContent
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]![0].title).toBe(thirdTitle)
  })

  it('mostra mensagem de vazio quando a busca não encontra nada', async () => {
    const user = userEvent.setup()
    render(<CommandPalette state={initialState} actions={actions} onClose={() => {}} onSelect={() => {}} />)
    await user.type(screen.getByRole('combobox'), 'xxxxxxxxxxxxxxxxxx')
    expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument()
  })

  it('fecha ao chamar onClose via onSelect', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CommandPalette state={initialState} actions={actions} onClose={onClose} onSelect={() => {}} />)
    await user.click(screen.getByRole('option', { name: /Nova tarefa/ }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
