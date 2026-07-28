import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { jsonRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  auditFindMany: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({
    task: { findFirst: fakes.findFirst, findMany: fakes.findMany, update: fakes.update },
    auditLog: { findMany: fakes.auditFindMany },
  }),
}))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, PATCH } from './route'

const url = 'http://localhost/api/tasks/task-1'
const context = () => ({ params: Promise.resolve({ id: 'task-1' }) })

const patch = (body: unknown) => PATCH(jsonRequest(url, body, { method: 'PATCH' }), context())

describe('rota de edição de card', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.findFirst.mockReset().mockResolvedValue({ id: 'task-1', projectId: 'project-1' })
    fakes.findMany.mockReset().mockResolvedValue([])
    fakes.update.mockReset().mockResolvedValue({ id: 'task-1' })
    fakes.auditFindMany.mockReset().mockResolvedValue([{ id: 'audit-1', action: 'task.created' }])
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await PATCH(jsonRequest(url, { title: 'Novo' }, { method: 'PATCH' }), context())

    expect(response.status).toBe(401)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('responde 404 para card de outro dono', async () => {
    fakes.findFirst.mockResolvedValueOnce(null)

    const response = await patch({ title: 'Renomear' })

    expect(response.status).toBe(404)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('responde 400 para status fora do enum', async () => {
    const response = await patch({ status: 'QUASE_PRONTO' })

    expect(response.status).toBe(400)
    expect(fakes.update).not.toHaveBeenCalled()
  })

  it('registra mover separado de editar para o histórico ficar legível', async () => {
    await patch({ status: 'COMPLETED' })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.moved' }))

    await patch({ status: 'COMPLETED', priority: 'P0' })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.updated' }))
  })

  it('devolve o histórico do card e 404 quando o card não é do dono', async () => {
    const response = await GET(new Request(url), context())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ history: [{ id: 'audit-1', action: 'task.created' }] })

    fakes.findFirst.mockResolvedValueOnce(null)
    const denied = await GET(new Request(url), context())

    expect(denied.status).toBe(404)
  })
})
