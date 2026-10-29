'use client'

import { FileText, MagicWand, Microphone, NotePencil, PaperPlaneTilt } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import type { Project } from './domain'
import { useAudioRecorder } from './contextFlow'

type CaptureMode = 'task' | 'note'

export function TodayCapture({ projects, onCaptureTask, onSaveNote, onCaptureAudio }: {
  projects: Pick<Project, 'id' | 'name'>[]
  onCaptureTask: (text: string) => Promise<unknown> | unknown
  onCaptureAudio?: (audio: Blob) => Promise<unknown> | unknown
  onSaveNote: (input: { content: string; projectId: string }) => Promise<unknown> | unknown
}) {
  const id = useId()
  const titleId = `${id}-title`
  const contentId = `${id}-content`
  const [mode, setMode] = useState<CaptureMode>('task')
  const [content, setContent] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [audioBusy, setAudioBusy] = useState(false)
  const recorder = useAudioRecorder((blob) => {
    void sendAudio(blob)
  })

  function reportAudioError(operation: string, error: unknown, message: string) {
    const failure = error instanceof Error ? error : new Error(`Falha em ${operation}`, { cause: error })
    console.error({ operation, component: 'TodayCapture', error,
      stack: failure.stack, cause: failure.cause })
    setAudioError(message)
  }

  async function sendAudio(blob: Blob) {
    setAudioBusy(true)
    try {
      const result = await onCaptureAudio?.(blob)
      if (result === null) setAudioError('Não foi possível enviar o áudio. Tente novamente.')
    } catch (error) {
      reportAudioError('today.audio.upload', error, 'Não foi possível enviar o áudio. Tente novamente.')
    } finally {
      setAudioBusy(false)
    }
  }

  async function toggleRecording() {
    setAudioError('')
    if (recorder.recording) { recorder.stop(); return }
    setAudioBusy(true)
    try {
      await recorder.start()
    } catch (error) {
      reportAudioError('today.audio.start', error, 'Não foi possível acessar o microfone.')
    } finally {
      setAudioBusy(false)
    }
  }

  const canSave = Boolean(content.trim() && (mode === 'task' || projectId) && !saving && !audioBusy && !recorder.recording)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = content.trim()
    if (!text || saving) return

    setSaving(true)
    try {
      if (mode === 'task') await onCaptureTask(text)
      else if (projectId) await onSaveNote({ content: text, projectId })
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  return <section className="today-capture" aria-labelledby={titleId}>
    <div className="today-capture-heading">
      <div>
        <h2 id={titleId}>O que você precisa lembrar?</h2>
        <p>{mode === 'task'
          ? 'A IA organiza tarefas, reuniões e encaminhamentos para revisão.'
          : 'Nota privada do projeto. O conteúdo não é enviado à IA.'}</p>
      </div>
      <MagicWand size={21} weight="duotone" aria-hidden="true" />
    </div>

    <div className="today-capture-mode" role="group" aria-label="Salvar como">
      <button type="button" aria-pressed={mode === 'task'} className={mode === 'task' ? 'active' : ''} disabled={audioBusy || recorder.recording} onClick={() => setMode('task')}>
        <PaperPlaneTilt size={16} />Tarefa
      </button>
      <button type="button" aria-pressed={mode === 'note'} className={mode === 'note' ? 'active' : ''} disabled={audioBusy || recorder.recording} onClick={() => setMode('note')}>
        <NotePencil size={16} />Nota
      </button>
    </div>

    {mode === 'task' && onCaptureAudio && <button
      type="button" className="today-capture-submit"
      disabled={audioBusy || saving} aria-pressed={recorder.recording}
      onClick={() => { void toggleRecording() }}
    >
      <Microphone size={18} weight={recorder.recording ? 'fill' : 'regular'} />
      {recorder.recording ? 'Parar gravação' : audioBusy ? 'Preparando áudio…' : 'Gravar áudio'}
    </button>}
    {audioError && <p role="alert">{audioError}</p>}

    <form onSubmit={submit}>
      <label className="today-capture-label" htmlFor={contentId}>{mode === 'task' ? 'Descreva a tarefa ou reunião' : 'Escreva sua nota privada'}</label>
      <textarea
        id={contentId}
        aria-label="O que você precisa lembrar?"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={mode === 'task' ? 'Ex.: alinhar entrega com a equipe na reunião de sexta…' : 'Guarde uma ideia ou informação pessoal…'}
        rows={3}
      />
      {mode === 'note' && <label className="today-capture-project">Projeto da nota
        <select aria-label="Projeto da nota" required value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Selecione um projeto</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>}
      <button className="today-capture-submit" type="submit" disabled={!canSave}>
        {mode === 'task' ? <><FileText size={18} />Enviar para revisão IA</> : <><NotePencil size={18} />Salvar nota privada</>}
      </button>
    </form>
  </section>
}
