import { beforeEach, describe, expect, it, vi } from 'vitest'

const handler = {
  GET: vi.fn(),
  POST: vi.fn(),
}

vi.mock('../../../../lib/auth/server', () => ({
  getNeonAuth: () => ({ handler: () => handler }),
}))

import { GET, POST } from './route'

const contextFor = (path: string[]) => ({ params: Promise.resolve({ path }) })

describe('auth route', () => {
  beforeEach(() => {
    handler.GET.mockReset()
    handler.POST.mockReset()
  })

  it('nao entrega rota vulneravel ao handler Neon', async () => {
    const response = await POST(new Request('http://localhost/api/auth/mcp/token'), contextFor(['mcp', 'token']))

    expect(response.status).toBe(404)
    expect(handler.POST).not.toHaveBeenCalled()
  })

  it('entrega login por senha ao handler Neon', async () => {
    handler.POST.mockResolvedValue(new Response(null, { status: 204 }))

    const response = await POST(new Request('http://localhost/api/auth/sign-in/email', { method: 'POST' }), contextFor(['sign-in', 'email']))

    expect(response.status).toBe(204)
    expect(handler.POST).toHaveBeenCalledOnce()
  })

  it('entrega consulta de sessao ao handler Neon', async () => {
    handler.GET.mockResolvedValue(new Response(null, { status: 204 }))

    const response = await GET(new Request('http://localhost/api/auth/get-session'), contextFor(['get-session']))

    expect(response.status).toBe(204)
    expect(handler.GET).toHaveBeenCalledOnce()
  })

  it('repete login quando o upstream falha por transporte', async () => {
    handler.POST
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const request = new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'teste@exemplo.com', password: 'senha-segura' }),
    })
    const response = await POST(request, contextFor(['sign-in', 'email']))

    expect(response.status).toBe(204)
    expect(handler.POST).toHaveBeenCalledTimes(2)
    await expect(handler.POST.mock.calls[1][0].json()).resolves.toEqual({ email: 'teste@exemplo.com', password: 'senha-segura' })
  })
})
