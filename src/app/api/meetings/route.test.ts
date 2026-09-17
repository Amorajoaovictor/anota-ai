import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  projectFindFirst: vi.fn(),
  meetingFindMany: vi.fn(),
  meetingCreate: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({
    project: { findFirst: fakes.projectFindFirst },
    meeting: { findMany: fakes.meetingFindMany, create: fakes.meetingCreate },
  }),
}))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, POST } from './route'

const url = 'http://localhost/api/meetings'

describe('rota de reuniões', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.projectFindFirst.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.meetingFindMany.mockReset().mockResolvedValue([{ id: 'meeting-1' }])
    fakes.meetingCreate.mockReset().mockResolvedValue({ id: 'meeting-1', projectId: 'project-1' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await POST(jsonRequest(url, { title: 'Alinhamento', startsAt: '2026-09-15T10:00:00.000Z', timezone: 'America/Sao_Paulo' }), undefined)

    expect(response.status).toBe(401)
    expect(fakes.meetingCreate).not.toHaveBeenCalled()
  })

  it('lista reuniões do dono', async () => {
    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ meetings: [{ id: 'meeting-1' }] })
  })

  it('cria reunião e audita sem descrição', async () => {
    const response = await POST(jsonRequest(url, {
      projectId: 'project-1', title: 'Alinhamento', description: 'Não deve entrar na auditoria', startsAt: '2026-09-15T10:00:00.000Z', timezone: 'America/Sao_Paulo',
    }), undefined)

    expect(response.status).toBe(201)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith({
      actorId: 'user-1', action: 'meeting.created', entityType: 'Meeting', entityId: 'meeting-1', metadata: { projectId: 'project-1' },
    })
  })
})
