import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoogleIntegration } from './googleIntegration'
afterEach(() => vi.unstubAllGlobals())
describe('conexão Google', () => {
  it('oferece conexão apenas quando servidor configurado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ connected: false, configured: true }))))
    render(<GoogleIntegration />)
    expect(await screen.findByRole('link', { name: 'Conectar Google Calendar' })).toHaveAttribute('href', '/api/integrations/google/connect')
  })
  it('informa configuração pendente sem oferecer OAuth quebrado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ connected: false, configured: false }))))
    render(<GoogleIntegration />)
    expect(await screen.findByText('Configuração Google pendente.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Conectar Google Calendar' })).not.toBeInTheDocument()
  })
})
