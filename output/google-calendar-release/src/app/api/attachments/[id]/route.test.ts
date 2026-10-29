import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { createMemoryStorage } from '../../../../server/storage/memory'
import { createFakeContentStore } from '../../../../test/fake-prisma'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  prisma: undefined as any,
  storage: undefined as any,
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({ getPrisma: () => fakes.prisma }))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))
vi.mock('../../../../server/storage', () => ({ getStorage: () => fakes.storage }))

import { DELETE, GET } from './route'

const url = 'http://localhost/api/attachments/attachment-1'
const contextOf = (id: string) => ({ params: Promise.resolve({ id }) })
const bytes = new Uint8Array([1, 2, 3])

let attachmentId: string

describe('rotas de anexo por id', () => {
  beforeEach(async () => {
    fakes.prisma = createFakeContentStore({ projects: [{ id: 'project-1', ownerId: 'user-1' }], tasks: [] })
    fakes.storage = createMemoryStorage()
    await fakes.storage.put('user-1/anexo-1', bytes)
    const attachment = await fakes.prisma.attachment.create({
      data: {
        projectId: 'project-1',
        taskId: null,
        storageKey: 'user-1/anexo-1',
        filename: 'planta.png',
        contentType: 'image/png',
        sizeBytes: bytes.byteLength,
      },
    })
    attachmentId = attachment.id
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.recordAuditEvent.mockClear()
  })

  it('recusa download sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await GET(new Request(url), contextOf(attachmentId))

    expect(response.status).toBe(401)
  })

  it('entrega o arquivo do dono sem deixar cache', async () => {
    const response = await GET(new Request(url), contextOf(attachmentId))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-length')).toBe('3')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('responde 404 no download de anexo de outro dono', async () => {
    fakes.requireCurrentUserId.mockResolvedValue('user-2')

    const response = await GET(new Request(url), contextOf(attachmentId))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Anexo não encontrado.' })
  })

  it('responde 404 quando o registro existe mas o arquivo sumiu do storage', async () => {
    await fakes.storage.delete('user-1/anexo-1')

    const response = await GET(new Request(url), contextOf(attachmentId))

    expect(response.status).toBe(404)
  })

  it('recusa exclusão sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await DELETE(new Request(url, { method: 'DELETE' }), contextOf(attachmentId))

    expect(response.status).toBe(401)
    expect(fakes.prisma.attachments).toHaveLength(1)
  })

  it('responde 404 na exclusão de anexo de outro dono', async () => {
    fakes.requireCurrentUserId.mockResolvedValue('user-2')

    const response = await DELETE(new Request(url, { method: 'DELETE' }), contextOf(attachmentId))

    expect(response.status).toBe(404)
    expect(fakes.prisma.attachments).toHaveLength(1)
    expect(fakes.storage.entries.size).toBe(1)
    expect(fakes.recordAuditEvent).not.toHaveBeenCalled()
  })

  it('responde 404 para id inexistente', async () => {
    const response = await DELETE(new Request(url, { method: 'DELETE' }), contextOf('nao-existe'))

    expect(response.status).toBe(404)
  })

  it('apaga registro e arquivo e registra auditoria', async () => {
    const response = await DELETE(new Request(url, { method: 'DELETE' }), contextOf(attachmentId))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: attachmentId })
    expect(fakes.prisma.attachments).toHaveLength(0)
    expect(fakes.storage.entries.size).toBe(0)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'user-1', action: 'attachment.deleted', entityId: attachmentId }),
    )
  })
})
