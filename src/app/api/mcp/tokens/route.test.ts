import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'

const fakes = vi.hoisted(() => ({
  owner: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.owner }))
vi.mock('../../../../lib/prisma', () => ({ getPrisma: () => ({ mcpToken: { create: fakes.create, findMany: fakes.findMany } }) }))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.audit }))

import { GET, POST } from './route'

describe('tokens MCP', () => {
  beforeEach(() => {
    fakes.owner.mockReset().mockResolvedValue('owner-1')
    fakes.create.mockReset().mockResolvedValue({ id: 'token-1', name: 'Codex', scopes: ['read'], expiresAt: new Date('2030-01-01') })
    fakes.findMany.mockReset().mockResolvedValue([])
    fakes.audit.mockReset().mockResolvedValue(undefined)
  })

  it('recusa emissão sem sessão', async () => {
    fakes.owner.mockRejectedValueOnce(new UnauthorizedError())
    const response = await POST(new Request('http://localhost/api/mcp/tokens', { method: 'POST', body: JSON.stringify({ name: 'Codex', scopes: ['read'] }) }), undefined)
    expect(response.status).toBe(401)
    expect(fakes.create).not.toHaveBeenCalled()
  })

  it('emite token ao dono e nunca o inclui na listagem', async () => {
    const response = await POST(new Request('http://localhost/api/mcp/tokens', { method: 'POST', body: JSON.stringify({ name: 'Codex', scopes: ['read'] }) }), undefined)
    expect(response.status).toBe(201)
    expect((await response.json()).token).toMatch(/^anota_mcp_/)
    await GET(new Request('http://localhost/api/mcp/tokens'), undefined)
    expect(fakes.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1' }, select: expect.not.objectContaining({ tokenHash: true }) }))
  })

  it('correlaciona erro inesperado sem expor segredo na resposta', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fakes.create.mockRejectedValueOnce(new Error('database unavailable'))
      const response = await POST(new Request('http://localhost/api/mcp/tokens', { method: 'POST',
        body: JSON.stringify({ name: 'Codex', scopes: ['read'] }),
      }), undefined)
      expect(response.status).toBe(500)
      expect(response.headers.get('x-request-id')).toBeTruthy()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('mcp.request_failed'))
      expect(await response.text()).not.toContain('database unavailable')
    } finally {
      log.mockRestore()
    }
  })
})
