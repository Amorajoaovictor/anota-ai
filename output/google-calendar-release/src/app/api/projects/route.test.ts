import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({ project: { create: fakes.create, findMany: fakes.findMany } }),
}))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, POST } from './route'

const url = 'http://localhost/api/projects'

describe('rotas de projetos', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.create.mockReset()
    fakes.findMany.mockReset().mockResolvedValue([])
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 na listagem sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(401)
    expect(fakes.findMany).not.toHaveBeenCalled()
  })

  it('responde 400 para corpo que não é JSON', async () => {
    const response = await POST(new Request(url, { method: 'POST', body: 'nao-json{' }), undefined)

    expect(response.status).toBe(400)
    expect(fakes.create).not.toHaveBeenCalled()
  })

  it('responde 400 com as issues de validação', async () => {
    const response = await POST(jsonRequest(url, { name: '  ' }), undefined)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Dados inválidos.' })
  })

  it('responde 409 quando o dono já tem projeto com o mesmo nome', async () => {
    fakes.create.mockRejectedValueOnce({ code: 'P2002' })

    const response = await POST(jsonRequest(url, { name: 'Observa' }), undefined)

    expect(response.status).toBe(409)
  })

  it('responde 500 sem detalhes quando o banco falha', async () => {
    fakes.create.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.4:5432'))

    const response = await POST(jsonRequest(url, { name: 'Observa' }), undefined)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Erro interno.' })
  })

  it('cria projeto e registra auditoria', async () => {
    fakes.create.mockResolvedValueOnce({ id: 'project-1', name: 'Observa' })

    const response = await POST(jsonRequest(url, { name: 'Observa' }), undefined)

    expect(response.status).toBe(201)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.created' }))
  })
})
