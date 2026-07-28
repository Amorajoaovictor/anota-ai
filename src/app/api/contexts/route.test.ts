import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  projectFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
  contextFindMany: vi.fn(),
  contextCreate: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({
    project: { findFirst: fakes.projectFindFirst },
    task: { findFirst: fakes.taskFindFirst },
    projectContext: { findMany: fakes.contextFindMany, create: fakes.contextCreate },
  }),
}))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, POST } from './route'

const url = 'http://localhost/api/contexts'
const post = (body: unknown) => POST(jsonRequest(url, body), undefined)

describe('rotas de contexto de projeto', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.projectFindFirst.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.taskFindFirst.mockReset().mockResolvedValue({ id: 'task-1' })
    fakes.contextFindMany.mockReset().mockResolvedValue([{ id: 'context-1' }])
    fakes.contextCreate.mockReset().mockResolvedValue({ id: 'context-1', title: 'Regra da CEGEO' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(401)
  })

  it('lista contextos dos projetos do dono', async () => {
    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contexts: [{ id: 'context-1' }] })
  })

  it('responde 404 para projeto de outro dono', async () => {
    fakes.projectFindFirst.mockResolvedValueOnce(null)

    const response = await post({ projectId: 'project-de-outro', title: 'Regra', content: 'Texto' })

    expect(response.status).toBe(404)
    expect(fakes.contextCreate).not.toHaveBeenCalled()
  })

  it('responde 400 sem título ou sem conteúdo', async () => {
    expect((await post({ projectId: 'project-1', title: '  ', content: 'Texto' })).status).toBe(400)
    expect((await post({ projectId: 'project-1', title: 'Regra', content: '  ' })).status).toBe(400)
    expect(fakes.contextCreate).not.toHaveBeenCalled()
  })

  it('cria o contexto e registra a auditoria', async () => {
    const response = await post({ projectId: 'project-1', title: 'Regra da CEGEO', content: 'Texto', taskId: 'task-1' })

    expect(response.status).toBe(201)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: 'context.created',
      entityType: 'ProjectContext',
      entityId: 'context-1',
      metadata: { title: 'Regra da CEGEO' },
    })
  })
})
