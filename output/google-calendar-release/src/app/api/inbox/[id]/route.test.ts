import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { jsonRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  inboxFindFirst: vi.fn(),
  inboxUpdate: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({ inboxItem: { findFirst: fakes.inboxFindFirst, update: fakes.inboxUpdate } }),
}))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { PATCH } from './route'

const url = 'http://localhost/api/inbox/inbox-1'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })
const patch = (body: unknown) => PATCH(jsonRequest(url, body, { method: 'PATCH' }), context())

describe('PATCH /api/inbox/[id]', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.inboxFindFirst.mockReset().mockResolvedValue({ id: 'inbox-1' })
    fakes.inboxUpdate.mockReset().mockResolvedValue({ id: 'inbox-1', status: 'DISCARDED' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    expect((await patch({ status: 'Descartada' })).status).toBe(401)
  })

  it('só aceita descartar — qualquer outro corpo é 400', async () => {
    expect((await patch({ status: 'Processada' })).status).toBe(400)
    expect((await patch({ title: 'Outra coisa' })).status).toBe(400)
    expect(fakes.inboxUpdate).not.toHaveBeenCalled()
  })

  it('responde 404 para entrada de outro dono', async () => {
    fakes.inboxFindFirst.mockResolvedValueOnce(null)

    const response = await patch({ status: 'Descartada' })

    expect(response.status).toBe(404)
  })

  it('descarta e registra auditoria', async () => {
    const response = await patch({ status: 'Descartada' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ inboxItem: { id: 'inbox-1', status: 'DISCARDED' } })
    expect(fakes.inboxUpdate).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'DISCARDED' } })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'inbox.discarded' }))
  })
})
