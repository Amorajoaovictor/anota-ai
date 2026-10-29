'use client'
import { CalendarBlank } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from './ui'
export function GoogleIntegration() {
  const [status, setStatus] = useState<{ connected: boolean; configured: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/integrations/google').then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}; requestId=${response.headers.get('x-request-id') ?? 'unknown'}`)
      return response.json()
    }).then((result) => { if (active) setStatus(result) }).catch((cause) => {
      if (active) setError(`Não foi possível consultar conexão Google. ${cause instanceof Error ? cause.message : ''}`)
    })
    return () => { active = false }
  }, [])
  return <section className="view-panel integration-card">
    <CalendarBlank size={30} /><strong>Google Calendar e Meet</strong>
    <span>Agende reuniões no Calendar e gere links do Google Meet pelo agente e MCP.</span>
    {error ? <span role="alert">{error}</span> : !status ? <span>Consultando conexão…</span> : !status.configured ? <span>Configuração Google pendente.</span> : <>
      {status.connected && <span>Google conectado. Agendamento online disponível.</span>}
      <a className="primary-button" href="/api/integrations/google/connect">{status.connected ? 'Reconectar Google Calendar' : 'Conectar Google Calendar'}</a>
    </>}
  </section>
}
export function GoogleMeetingButton({ meetingId }: { meetingId: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function schedule() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/google`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok) { setMessage(`${body.error ?? 'Não foi possível agendar no Google.'} Referência: ${response.headers.get('x-request-id') ?? 'indisponível'}`); return }
      if (body.conferenceStatus === 'pending') setMessage('Evento criado. Meet sendo gerado; clique novamente para consultar.')
      else window.location.reload()
    } catch (cause) {
      setMessage(`Conexão interrompida ao agendar. Pode tentar novamente com segurança. ${cause instanceof Error ? cause.message : ''}`)
    } finally { setBusy(false) }
  }
  return <><Button disabled={busy} onClick={() => void schedule()}>{busy ? 'Agendando…' : 'Agendar no Google e gerar Meet'}</Button>{message && <span role="status">{message}</span>}</>
}
