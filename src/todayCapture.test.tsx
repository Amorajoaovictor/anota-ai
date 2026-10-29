import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/**
 * Protege captura de voz direto na home, sem exigir digitação.
 * Detecta sumiço do botão ou gravação sem envio; usuário perderia captura rápida mobile.
 */
describe('TodayCapture audio', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
  function mockMicrophone() {
    const stopTrack = vi.fn()
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    class Recorder {
      mimeType = 'audio/webm'
      ondataavailable?: (event: { data: Blob }) => void
      onstop?: () => void
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) })
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder)
    return { getUserMedia, stopTrack }
  }

  it('grava e envia áudio para revisão IA sem exigir texto', async () => {
    const { getUserMedia, stopTrack } = mockMicrophone()
    const onCaptureAudio = vi.fn().mockResolvedValue('inbox-audio')
    const onCaptureTask = vi.fn()
    const onSaveNote = vi.fn()
    render(<TodayCapture projects={projects} onCaptureTask={onCaptureTask} onSaveNote={onSaveNote} onCaptureAudio={onCaptureAudio} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Parar gravação' }))
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(onCaptureAudio).toHaveBeenCalledWith(expect.any(Blob))
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(onCaptureTask).not.toHaveBeenCalled()
    expect(onSaveNote).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  /** Protege privacidade: modo Nota não deve enviar voz ao processamento IA. */
  it('não oferece gravação IA no modo Nota privada', async () => {
    render(<TodayCapture projects={projects} onCaptureTask={vi.fn()} onSaveNote={vi.fn()} onCaptureAudio={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nota' }))
    expect(screen.queryByRole('button', { name: 'Gravar áudio' })).not.toBeInTheDocument()
  })

  /** Protege recuperação: permissão negada precisa informar usuário e permitir nova tentativa. */
  it('informa falha de microfone e mantém botão disponível', async () => {
    const { getUserMedia } = mockMicrophone()
    const error = new DOMException('Permission denied', 'NotAllowedError')
    getUserMedia.mockRejectedValueOnce(error)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<TodayCapture projects={projects} onCaptureTask={vi.fn()} onSaveNote={vi.fn()} onCaptureAudio={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível acessar o microfone.')
    expect(screen.getByRole('button', { name: 'Gravar áudio' })).toBeEnabled()
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ operation: 'today.audio.start', error, stack: expect.any(String) }))
    log.mockRestore()
    vi.unstubAllGlobals()
  })
})
