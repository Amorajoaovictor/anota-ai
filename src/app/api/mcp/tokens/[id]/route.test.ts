import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../../server/http'

const fakes = vi.hoisted(() => ({ owner: vi.fn(), updateMany: vi.fn(), audit: vi.fn() }))
vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.owner }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({ mcpToken: { updateMany: fakes.updateMany } }) }))
vi.mock('../../../../../server/audit-log', () => ({ recordAuditEvent: fakes.audit }))

import { DELETE } from './route'

describe('revogação de token MCP', () => {
  beforeEach(() => {
    fakes.owner.mockReset().mockResolvedValue('owner-1')
    fakes.updateMany.mockReset().mockResolvedValue({ count: 1 })
    fakes.audit.mockReset().mockResolvedValue(undefined)
  })

  it('não revoga token sem sessão', async () => {
    fakes.owner.mockRejectedValueOnce(new UnauthorizedError())
    const response = await DELETE(new Request('http://localhost/api/mcp/tokens/token-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'token-1' }) })
    expect(response.status).toBe(401)
    expect(fakes.updateMany).not.toHaveBeenCalled()
  })

  it('revoga somente token do dono e registra auditoria', async () => {
    const response = await DELETE(new Request('http://localhost/api/mcp/tokens/token-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'token-1' }) })
    expect(response.status).toBe(200)
    expect(fakes.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'token-1', ownerId: 'owner-1', revokedAt: null } }))
    expect(fakes.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp.token.revoked', actorId: 'owner-1' }))
  })
})
