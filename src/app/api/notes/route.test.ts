import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  projectFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
  noteFindMany: vi.fn(),
  noteCreate: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({
    project: { findFirst: fakes.projectFindFirst },
    task: { findFirst: fakes.taskFindFirst },
    note: { findMany: fakes.noteFindMany, create: fakes.noteCreate },
  }),
}))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, POST } from './route'

const url = 'http://localhost/api/notes'
const post = (body: unknown) => POST(jsonRequest(url, body), undefined)

describe('rota de notas privadas', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.projectFindFirst.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.taskFindFirst.mockReset().mockResolvedValue(null)
    fakes.noteFindMany.mockReset().mockResolvedValue([{ id: 'note-1' }])
    fakes.noteCreate.mockReset().mockResolvedValue({ id: 'note-1', projectId: 'project-1' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await post({ projectId: 'project-1', content: 'Texto' })

    expect(response.status).toBe(401)
    expect(fakes.noteCreate).not.toHaveBeenCalled()
  })

  it('lista notas do dono', async () => {
    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ notes: [{ id: 'note-1' }] })
  })

  it('responde 404 para projeto de outro dono', async () => {
    fakes.projectFindFirst.mockResolvedValueOnce(null)

    const response = await post({ projectId: 'project-de-outro', content: 'Texto' })

    expect(response.status).toBe(404)
    expect(fakes.noteCreate).not.toHaveBeenCalled()
  })

  it('responde 400 para nota sem conteúdo', async () => {
    const response = await post({ projectId: 'project-1', content: '   ' })

    expect(response.status).toBe(400)
    expect(fakes.noteCreate).not.toHaveBeenCalled()
  })

  it('cria a nota e audita só o vínculo, nunca o texto privado', async () => {
    const response = await post({ projectId: 'project-1', content: 'Conferir camadas' })

    expect(response.status).toBe(201)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: 'note.created',
      entityType: 'Note',
      entityId: 'note-1',
      metadata: { projectId: 'project-1' },
    })
  })
})
