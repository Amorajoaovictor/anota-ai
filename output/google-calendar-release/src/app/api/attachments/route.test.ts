import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { createMemoryStorage } from '../../../server/storage/memory'
import { createFakeContentStore } from '../../../test/fake-prisma'
import { multipartRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  prisma: undefined as any,
  storage: undefined as any,
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  maxUploadBytes: 1024,
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({ getPrisma: () => fakes.prisma }))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))
vi.mock('../../../server/storage', () => ({
  getStorage: () => fakes.storage,
  getMaxUploadBytes: () => fakes.maxUploadBytes,
}))

import { POST } from './route'

const png = (size = 3) => ({ name: 'planta.png', type: 'image/png', bytes: new Uint8Array(size) })
const url = 'http://localhost/api/attachments'

describe('POST /api/attachments', () => {
  beforeEach(() => {
    fakes.prisma = createFakeContentStore({
      projects: [{ id: 'project-1', ownerId: 'user-1' }],
      tasks: [],
    })
    fakes.storage = createMemoryStorage()
    fakes.maxUploadBytes = 1024
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.recordAuditEvent.mockClear()
  })

  it('recusa envio sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await POST(multipartRequest(url, png(), { projectId: 'project-1' }), undefined)

    expect(response.status).toBe(401)
    expect(fakes.storage.entries.size).toBe(0)
  })

  it('grava anexo do projeto e registra auditoria', async () => {
    const response = await POST(multipartRequest(url, png(), { projectId: 'project-1' }), undefined)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.attachment).toMatchObject({ filename: 'planta.png', contentType: 'image/png', sizeBytes: 3 })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'attachment.created' }))
  })

  it('responde 413 acima do limite configurado', async () => {
    const response = await POST(multipartRequest(url, png(2048), { projectId: 'project-1' }), undefined)

    expect(response.status).toBe(413)
    expect(fakes.storage.entries.size).toBe(0)
  })

  it('responde 404 para projeto de outro dono', async () => {
    fakes.requireCurrentUserId.mockResolvedValue('user-2')

    const response = await POST(multipartRequest(url, png(), { projectId: 'project-1' }), undefined)

    expect(response.status).toBe(404)
  })

  it('responde 400 quando falta o arquivo', async () => {
    const form = new FormData()
    form.set('projectId', 'project-1')

    const response = await POST(new Request(url, { method: 'POST', body: form }), undefined)

    expect(response.status).toBe(400)
  })
})
