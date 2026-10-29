import { describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => ({ findUnique: vi.fn(), findManyProjects: vi.fn(), createProject: vi.fn(), audit: vi.fn() }))
vi.mock('../../../lib/prisma', () => ({ getPrisma: () => {
  const db = { mcpToken: { findUnique: fakes.findUnique }, project: { findMany: fakes.findManyProjects, create: fakes.createProject },
    auditLog: { create: fakes.audit } }
  return { ...db, $transaction: async (callback: (transaction: typeof db) => Promise<unknown>) => callback(db) }
} }))

import { POST } from './route'

describe('MCP remoto', () => {
  function request(name: string, args: Record<string, unknown>) {
    return new Request('http://localhost/api/mcp', { method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream',
        authorization: `Bearer anota_mcp_${'a'.repeat(64)}`, 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }),
    })
  }

  async function message(response: Response) {
    const body = await response.text()
    const data = body.split('\n').find((line) => line.startsWith('data: '))
    return JSON.parse(data!.slice(6))
  }

  it('rejeita chamada sem token antes de executar ferramentas', async () => {
    const response = await POST(new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }))
    expect(response.status).toBe(401)
    expect(fakes.findUnique).not.toHaveBeenCalled()
  })

  it('rejeita token inválido', async () => {
    fakes.findUnique.mockResolvedValue(null)
    const response = await POST(new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer anota_mcp_${'a'.repeat(64)}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }))
    expect(response.status).toBe(401)
  })

  it('anuncia ferramentas no protocolo MCP com token válido', async () => {
    fakes.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'],
      expiresAt: new Date('2030-01-01'), revokedAt: null })
    const response = await POST(new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream',
        authorization: `Bearer anota_mcp_${'a'.repeat(64)}`, 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }))
    expect(response.status).toBe(200)
    const body = await response.text()
    const data = body.split('\n').find((line) => line.startsWith('data: '))
    expect(data).toBeDefined()
    const result = JSON.parse(data!.slice(6))
    expect(result.result.tools.map((tool: { name: string }) => tool.name)).toContain('projects.list')
    expect(result.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('notes.list')
  })

  it('aplica escopo e dono ao chamar ferramentas pelo protocolo', async () => {
    fakes.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'],
      expiresAt: new Date('2030-01-01'), revokedAt: null })
    fakes.findManyProjects.mockResolvedValue([])
    fakes.audit.mockResolvedValue({ id: 'audit-1' })

    const listed = await message(await POST(request('projects.list', {})))
    expect(listed.result.content[0].text).toContain('projects')
    expect(fakes.findManyProjects).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1' } }))

    const denied = await message(await POST(request('projects.create', { name: 'Outro', confirmed: true })))
    expect(denied.result.isError).toBe(true)
    expect(denied.result.content[0].text).toContain('INSUFFICIENT_SCOPE')
    expect(fakes.createProject).not.toHaveBeenCalled()
  })

  it('lista ferramentas para cliente MCP atual', async () => {
    fakes.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'],
      expiresAt: new Date('2030-01-01'), revokedAt: null })
    const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json',
        authorization: `Bearer anota_mcp_${'a'.repeat(64)}`, 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      } } }),
    }))
    const body = await response.text()
    expect(response.status, body).toBe(200)
    const result = JSON.parse(body)
    expect(result.result.tools.map((tool: { name: string }) => tool.name)).toContain('tasks.create')
  })

  it('cria projeto só após confirmação com dono extraído do token', async () => {
    fakes.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['create'],
      expiresAt: new Date('2030-01-01'), revokedAt: null })
    fakes.createProject.mockResolvedValue({ id: 'project-1', name: 'Observa' })
    fakes.audit.mockResolvedValue({ id: 'audit-1' })

    const unconfirmed = await message(await POST(request('projects.create', { name: 'Observa' })))
    expect(unconfirmed.result.isError).toBe(true)
    expect(fakes.createProject).not.toHaveBeenCalled()

    const confirmed = await message(await POST(request('projects.create', { name: 'Observa', confirmed: true })))
    expect(confirmed.result.isError).not.toBe(true)
    expect(fakes.createProject).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner-1' }) }))
    expect(fakes.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'mcp.projects.create', actorId: 'owner-1' }) }))
  })

  it('não expõe detalhes de falha interna ao agente', async () => {
    fakes.findUnique.mockResolvedValue({ id: 'token-1', ownerId: 'owner-1', scopes: ['read'],
      expiresAt: new Date('2030-01-01'), revokedAt: null })
    fakes.findManyProjects.mockRejectedValueOnce(new Error('database connection string secret'))
    fakes.audit.mockResolvedValue({ id: 'audit-1' })

    const response = await message(await POST(request('projects.list', {})))
    expect(response.result.isError).toBe(true)
    expect(response.result.content[0].text).toContain('MCP_TOOL_FAILED')
    expect(response.result.content[0].text).not.toContain('database connection string secret')
  })
})
