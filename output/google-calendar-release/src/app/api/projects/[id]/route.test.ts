import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { jsonRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({ project: { findFirst: fakes.findFirst, update: fakes.update } }),
}))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { PATCH } from './route'

const url = 'http://localhost/api/projects/project-1'
const context = { params: Promise.resolve({ id: 'project-1' }) }

const patch = (body: unknown) => PATCH(jsonRequest(url, body, { method: 'PATCH' }), {
  params: Promise.resolve({ id: 'project-1' }),
})

describe('rota de edição de projeto', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.findFirst.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.update.mockReset().mockResolvedValue({ id: 'project-1', name: 'Observa' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await PATCH(jsonRequest(url, { name: 'Observa' }, { method: 'PATCH' }), context)

    expect(response.status).toBe(401)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('responde 404 para projeto de outro dono', async () => {
    fakes.findFirst.mockResolvedValueOnce(null)

    const response = await patch({ name: 'Sequestrado' })

    expect(response.status).toBe(404)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('responde 400 para campo fora do schema', async () => {
    const response = await patch({ progresso: 90 })

    expect(response.status).toBe(400)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('responde 409 quando o nome já pertence a outro projeto', async () => {
    fakes.update.mockRejectedValueOnce({ code: 'P2002' })

    const response = await patch({ name: 'Intranet' })

    expect(response.status).toBe(409)
  })

  it('separa arquivar de editar no registro de auditoria', async () => {
    await patch({ name: 'Observa' })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.updated' }))

    await patch({ archived: true })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.archived' }))

    await patch({ archived: false })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.restored' }))
  })
})
