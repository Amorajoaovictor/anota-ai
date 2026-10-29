import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { jsonRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  taskFindFirst: vi.fn(),
  noteFindFirst: vi.fn(),
  noteUpdate: vi.fn(),
  noteDelete: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({
    task: { findFirst: fakes.taskFindFirst },
    note: { findFirst: fakes.noteFindFirst, update: fakes.noteUpdate, delete: fakes.noteDelete },
  }),
}))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { DELETE, PATCH } from './route'

const url = 'http://localhost/api/notes/note-1'
const context = () => ({ params: Promise.resolve({ id: 'note-1' }) })
const patch = (body: unknown) => PATCH(jsonRequest(url, body, { method: 'PATCH' }), context())

describe('rota de edição e remoção de nota', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.taskFindFirst.mockReset().mockResolvedValue(null)
    fakes.noteFindFirst.mockReset().mockResolvedValue({ id: 'note-1', projectId: 'project-1' })
    fakes.noteUpdate.mockReset().mockResolvedValue({ id: 'note-1' })
    fakes.noteDelete.mockReset().mockResolvedValue({ id: 'note-1' })
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await patch({ pinned: true })

    expect(response.status).toBe(401)
    expect(fakes.noteUpdate).not.toHaveBeenCalled()
  })

  it('responde 404 para nota de outro dono, no patch e no delete', async () => {
    fakes.noteFindFirst.mockResolvedValue(null)

    expect((await patch({ pinned: true })).status).toBe(404)
    expect((await DELETE(new Request(url, { method: 'DELETE' }), context())).status).toBe(404)
    expect(fakes.noteUpdate).not.toHaveBeenCalled()
    expect(fakes.noteDelete).not.toHaveBeenCalled()
  })

  it('responde 400 para campo fora do schema estrito', async () => {
    const response = await patch({ ownerId: 'user-2' })

    expect(response.status).toBe(400)
    expect(fakes.noteUpdate).not.toHaveBeenCalled()
  })

  it('audita o que mudou sem registrar o texto da nota', async () => {
    const response = await patch({ content: 'Texto revisado', pinned: true })

    expect(response.status).toBe(200)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: 'note.updated',
      entityType: 'Note',
      entityId: 'note-1',
      metadata: { changed: ['content', 'pinned'] },
    })
  })

  it('remove a nota do dono e registra o evento', async () => {
    const response = await DELETE(new Request(url, { method: 'DELETE' }), context())

    expect(response.status).toBe(200)
    expect(fakes.noteDelete).toHaveBeenCalledWith({ where: { id: 'note-1' } })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'note.removed' }))
  })
})
