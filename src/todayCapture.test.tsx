import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TodayCapture } from './todayCapture'

const projects = [{ id: 'project-1', name: 'Central' }]

/**
 * Keep task captures on the AI review path and notes in private storage.
 * A route mix-up can expose private notes to AI or create notes without a valid project.
 */
describe('TodayCapture', () => {
  it('envia captura como tarefa para revisão de IA, sem salvá-la como nota', async () => {
    const user = userEvent.setup()
    const onCaptureTask = vi.fn()
    const onSaveNote = vi.fn()
    render(<TodayCapture projects={projects} onCaptureTask={onCaptureTask} onSaveNote={onSaveNote} />)

    await user.type(screen.getByRole('textbox', { name: 'O que você precisa lembrar?' }), 'Marcar reunião com equipe')
    await user.click(screen.getByRole('button', { name: 'Enviar para revisão IA' }))

    expect(onCaptureTask).toHaveBeenCalledWith('Marcar reunião com equipe')
    expect(onSaveNote).not.toHaveBeenCalled()
  })

  it('salva modo Nota na coleção privada e não envia conteúdo à IA', async () => {
    const user = userEvent.setup()
    const onCaptureTask = vi.fn()
    const onSaveNote = vi.fn()
    render(<TodayCapture projects={projects} onCaptureTask={onCaptureTask} onSaveNote={onSaveNote} />)

    await user.click(screen.getByRole('button', { name: 'Nota' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Projeto da nota' }), 'project-1')
    await user.type(screen.getByRole('textbox', { name: 'O que você precisa lembrar?' }), 'Anotar ideia privada')
    await user.click(screen.getByRole('button', { name: 'Salvar nota privada' }))

    expect(onSaveNote).toHaveBeenCalledWith({ content: 'Anotar ideia privada', projectId: 'project-1' })
    expect(onCaptureTask).not.toHaveBeenCalled()
  })

  it('exige um projeto antes de habilitar o salvamento de nota', async () => {
    const user = userEvent.setup()
    render(<TodayCapture projects={projects} onCaptureTask={vi.fn()} onSaveNote={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Nota' }))
    await user.type(screen.getByRole('textbox', { name: 'O que você precisa lembrar?' }), 'Nota do projeto')

    expect(screen.getByRole('button', { name: 'Salvar nota privada' })).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Projeto da nota' }), 'project-1')
    expect(screen.getByRole('button', { name: 'Salvar nota privada' })).toBeEnabled()
  })
})
