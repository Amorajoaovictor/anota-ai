import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({ deleteMany: vi.fn(), upsert: vi.fn(), exchange: vi.fn(), audit: vi.fn() }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({ googleOAuthState: { deleteMany: fake.deleteMany }, googleCalendarConnection: { upsert: fake.upsert }, auditLog: { create: fake.audit } }) }))
vi.mock('../../../../../server/mcp/with-owner', () => ({ withMcpOwner: (handler: any) => (request: Request) => handler({ ownerId: 'owner', request, requestId: 'request' }) }))
vi.mock('../../../../../server/google-calendar', () => ({ GOOGLE_SCOPE: 'calendar-scope', googleConfig: () => ({ redirectUri: 'https://app.example/api/integrations/google/callback', encryptionKey: 'key' }), exchangeGoogleToken: fake.exchange, sealToken: () => 'encrypted-token' }))
import { GET, POST } from './route'
const post = (origin = 'https://app.example') => new Request('https://app.example/api/integrations/google/callback', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: 's', code: 'c' }) })
beforeEach(() => { vi.clearAllMocks(); fake.deleteMany.mockResolvedValue({ count: 1 }); fake.exchange.mockResolvedValue({ access_token: 'private-access', refresh_token: 'private-refresh', scope: 'calendar-scope' }) })
describe('callback OAuth Google', () => {
  it('rejeita estado expirado, reutilizado ou de outro dono antes de trocar código', async () => {
    fake.deleteMany.mockResolvedValue({ count: 0 })
    await expect(POST(post(), {})).rejects.toThrow('expirada ou inválida')
    expect(fake.deleteMany).toHaveBeenCalledWith({ where: { stateHash: expect.any(String), ownerId: 'owner', expiresAt: { gt: expect.any(Date) } } })
    expect(fake.exchange).not.toHaveBeenCalled()
    expect(fake.upsert).not.toHaveBeenCalled()
  })
  it('não salva conexão se Google negar escopo solicitado', async () => {
    fake.exchange.mockResolvedValue({ access_token: 'a', refresh_token: 'r', scope: 'other-scope' })
    await expect(POST(post(), {})).rejects.toThrow('Permissão')
    expect(fake.upsert).not.toHaveBeenCalled()
  })
  it('persiste apenas refresh token criptografado para dono autenticado', async () => {
    const response = await POST(post(), {})
    expect(response.status).toBe(200)
    expect(fake.upsert).toHaveBeenCalledWith({ where: { ownerId: 'owner' }, create: { ownerId: 'owner', refreshToken: 'encrypted-token', scope: 'calendar-scope' }, update: { refreshToken: 'encrypted-token', scope: 'calendar-scope' } })
    expect(JSON.stringify(fake.audit.mock.calls)).not.toContain('private-')
  })
})

describe('retorno Google com cookies SameSite=Strict', () => {
  it('abre página própria antes de validar sessão, limpa código da URL e finaliza por POST', async () => {
    const response = await GET(new Request('https://app.example/api/integrations/google/callback?state=s&code=c'))
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('history.replaceState')
    expect(html).toContain('credentials:')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(fake.exchange).not.toHaveBeenCalled()
    expect(fake.deleteMany).not.toHaveBeenCalled()
  })
  it('rejeita conclusão de outra origem sem consumir estado nem trocar código', async () => {
    await expect(POST(post('https://other.example'), {})).rejects.toThrow('Origem')
    expect(fake.exchange).not.toHaveBeenCalled()
    expect(fake.deleteMany).not.toHaveBeenCalled()
  })
})
