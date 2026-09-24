'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button, type Notify } from './ui'

type Token = { id: string; name: string; scopes: string[]; expiresAt?: string; revokedAt?: string | null }
const availableScopes = [
  { value: 'read', label: 'Ler projetos, cards, contexto e inbox' },
  { value: 'create', label: 'Criar projetos, cards e entradas' },
  { value: 'update', label: 'Editar projetos, cards e entradas' },
  { value: 'context', label: 'Administrar contexto de projeto' },
]

export function McpIntegration({ notify }: { notify: Notify }) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read'])
  const [issued, setIssued] = useState<{ id: string; value: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/mcp/tokens').then(async (response) => {
      if (!response.ok) throw new Error(`GET /api/mcp/tokens: HTTP ${response.status}`)
      const body = await response.json() as { tokens: Token[] }
      if (active) setTokens(body.tokens)
    }).catch((error) => report('listar tokens MCP', error, notify))
    return () => { active = false }
  }, [notify])

  function toggleScope(value: string) {
    setScopes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  async function createToken(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !scopes.length) return
    setBusy(true)
    try {
      const response = await fetch('/api/mcp/tokens', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes }),
      })
      if (!response.ok) throw new Error(`POST /api/mcp/tokens: HTTP ${response.status}`)
      const body = await response.json() as { token: string; record: Token }
      setTokens((current) => [body.record, ...current])
      setIssued({ id: body.record.id, value: body.token })
      setName('')
      notify('Token criado. Copie agora: ele não será mostrado novamente.')
    } catch (error) {
      report('criar token MCP', error, notify)
    } finally {
      setBusy(false)
    }
  }

  async function revokeToken(token: Token) {
    setBusy(true)
    try {
      const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(token.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`DELETE /api/mcp/tokens/${token.id}: HTTP ${response.status}`)
      setTokens((current) => current.filter((item) => item.id !== token.id))
      setIssued((current) => current?.id === token.id ? null : current)
      notify('Conexão MCP revogada.')
    } catch (error) {
      report('revogar token MCP', error, notify)
    } finally {
      setBusy(false)
    }
  }

  return <section className="view-panel integration-card">
    <strong>MCP</strong>
    <span>Conecte agentes ao Anota Aí com permissões por conexão. O agente deve pedir sua confirmação antes de gravar.</span>
    <form onSubmit={createToken}>
      <label htmlFor="mcp-token-name">Nome da conexão</label>
      <input id="mcp-token-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      <fieldset>
        <legend>Permissões</legend>
        {availableScopes.map((scope) => <label key={scope.value}>
          <input type="checkbox" checked={scopes.includes(scope.value)} onChange={() => toggleScope(scope.value)} />
          {scope.label}
        </label>)}
      </fieldset>
      <Button type="submit" variant="primary" disabled={busy || !name.trim() || !scopes.length}>Criar token</Button>
    </form>
    {issued && <div>
      <strong>Copie agora. Este token aparece só uma vez.</strong>
      <code>{issued.value}</code>
      <span>URL remota: {typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'}</span>
      <span>Local: defina ANOTA_MCP_TOKEN e configure o agente para executar node --env-file=.env.local --import tsx src/server/mcp/stdio.ts neste projeto.</span>
    </div>}
    {tokens.filter((token) => !token.revokedAt).map((token) => <div key={token.id}>
      <span>{token.name} ({token.scopes.join(', ')})</span>
      <Button variant="danger" size="sm" disabled={busy} onClick={() => revokeToken(token)}>Revogar {token.name}</Button>
    </div>)}
  </section>
}

function report(operation: string, error: unknown, notify: Notify) {
  console.error(JSON.stringify({ event: 'mcp.integration_failed', operation,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  }))
  notify(`Não foi possível ${operation}.`, 'error')
}
