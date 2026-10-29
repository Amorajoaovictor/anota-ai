import { describe, expect, it, vi } from 'vitest'
import { createMcpToken, revokeMcpToken, verifyMcpToken } from './tokens'

function repository() {
  return { mcpToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() } }
}

describe('tokens MCP', () => {
  it('entrega segredo uma vez e grava apenas hash com dono e escopos', async () => {
    const db = repository()
    db.mcpToken.create.mockResolvedValue({ id: 'token-1', name: 'Agente', scopes: ['read'], expiresAt: new Date('2030-01-01') })

    const result = await createMcpToken(db as never, 'owner-1', { name: 'Agente', scopes: ['read'] })

    expect(result.token).toMatch(/^anota_mcp_[a-f0-9]{64}$/)
    expect(db.mcpToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: 'owner-1', name: 'Agente', scopes: ['read'], tokenHash: expect.any(String) }),
    }))
    expect(db.mcpToken.create.mock.calls[0]![0].data.tokenHash).not.toContain(result.token)
  })

  it('recusa token revogado ou expirado', async () => {
    const db = repository()
    db.mcpToken.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'], expiresAt: new Date('2020-01-01'), revokedAt: null })
    await expect(verifyMcpToken(db as never, 'anota_mcp_' + 'a'.repeat(64))).resolves.toBeNull()
    db.mcpToken.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'], expiresAt: new Date('2030-01-01'), revokedAt: new Date() })
    await expect(verifyMcpToken(db as never, 'anota_mcp_' + 'a'.repeat(64))).resolves.toBeNull()
  })

  it('não revoga token pertencente a outro usuário', async () => {
    const db = repository()
    db.mcpToken.updateMany.mockResolvedValue({ count: 0 })
    await revokeMcpToken(db as never, 'owner-1', 'token-2')
    expect(db.mcpToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'token-2', ownerId: 'owner-1', revokedAt: null } }))
  })
})
