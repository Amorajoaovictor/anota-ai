import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpIntegration } from './mcpIntegration'

describe('McpIntegration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mostra segredo somente na resposta de criação e permite revogar conexão', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tokens: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'anota_mcp_secret', record: { id: 'token-1', name: 'Agente', scopes: ['read'] } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revoked: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<McpIntegration notify={vi.fn()} />)

    await user.type(screen.getByLabelText('Nome da conexão'), 'Agente')
    await user.click(screen.getByRole('button', { name: 'Criar token' }))
    expect(await screen.findByText('anota_mcp_secret')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revogar Agente' }))
    await waitFor(() => expect(screen.queryByText('anota_mcp_secret')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls[2]![0]).toBe('/api/mcp/tokens/token-1')
  })
})
