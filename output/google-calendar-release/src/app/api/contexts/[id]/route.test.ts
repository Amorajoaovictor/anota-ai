import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { jsonRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  taskFindFirst: vi.fn(),
  contextFindFirst: vi.fn(),
  contextUpdate: vi.fn(),
  contextDelete: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({
    task: { findFirst: fakes.taskFindFirst },
    projectContext: {
      findFirst: fakes.contextFindFirst,
      update: fakes.contextUpdate,
      delete: fakes.contextDelete,
    },
  }),
}))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { DELETE, PATCH } from './route'

const url = 'http://localhost/api/contexts/context-1'
const context = () => ({ params: Promise.resolve({ id: 'context-1' }) })
const patch = (body: unknown) => PATCH(jsonRequest(url, body, { method: 'PATCH' }), context())

describe('rota de edição e remoção de contexto', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.taskFindFirst.mockReset().mockResolvedValue({ id: 'task-1' })
    fakes.contextFindFirst.mockReset().mockResolvedValue({ id: 'context-1', projectId: 'project-1' })
    fakes.contextUpdate.mockReset().mockResolvedValue({ id: 'context-1' })
    fakes.contextDelete.mockReset().mockResolvedValue({ id: 'context-1' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await patch({ title: 'Nova regra' })

    expect(response.status).toBe(401)
    expect(fakes.contextUpdate).not.toHaveBeenCalled()
  })

  it('responde 404 para contexto de outro dono, no patch e no delete', async () => {
    fakes.contextFindFirst.mockResolvedValue(null)

    expect((await patch({ title: 'Nova regra' })).status).toBe(404)
    expect((await DELETE(new Request(url, { method: 'DELETE' }), context())).status).toBe(404)
    expect(fakes.contextUpdate).not.toHaveBeenCalled()
    expect(fakes.contextDelete).not.toHaveBeenCalled()
  })

  it('responde 400 para título vazio', async () => {
    const response = await patch({ title: '   ' })

    expect(response.status).toBe(400)
    expect(fakes.contextUpdate).not.toHaveBeenCalled()
  })

  it('edita e remove registrando a auditoria', async () => {
    expect((await patch({ content: 'Texto revisado' })).status).toBe(200)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: 'context.updated',
      entityType: 'ProjectContext',
      entityId: 'context-1',
      metadata: { changed: ['content'] },
    })

    expect((await DELETE(new Request(url, { method: 'DELETE' }), context())).status).toBe(200)
    expect(fakes.contextDelete).toHaveBeenCalledWith({ where: { id: 'context-1' } })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'context.removed' }))
  })
})
