import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'
import { createMemoryStorage } from '../../../../server/storage/memory'
import { multipartRequest } from '../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  inboxCreate: vi.fn(),
  jobCreate: vi.fn(),
  storage: undefined as any,
  maxUploadBytes: 1024,
  drainJobs: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({
  getPrisma: () => ({
    inboxItem: { create: fakes.inboxCreate },
    job: { create: fakes.jobCreate },
  }),
}))
vi.mock('../../../../server/storage', () => ({
  getStorage: () => fakes.storage,
  getMaxUploadBytes: () => fakes.maxUploadBytes,
}))
vi.mock('../../../../server/jobs/runner', () => ({ drainJobs: fakes.drainJobs }))

import { POST } from './route'

const url = 'http://localhost/api/inbox/audio'
const audio = (size = 4) => ({ name: 'nota.webm', type: 'audio/webm', bytes: new Uint8Array(size) })

describe('POST /api/inbox/audio', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.inboxCreate.mockReset().mockResolvedValue({ id: 'inbox-1', source: 'AUDIO', status: 'TRANSCRIBING' })
    fakes.jobCreate.mockReset().mockResolvedValue({ id: 'job-1' })
    fakes.storage = createMemoryStorage()
    fakes.maxUploadBytes = 1024
    fakes.drainJobs.mockClear()
  })

  it('recusa envio sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await POST(multipartRequest(url, audio()), undefined)

    expect(response.status).toBe(401)
    expect(fakes.inboxCreate).not.toHaveBeenCalled()
  })

  it('responde 400 quando falta o arquivo', async () => {
    const form = new FormData()
    const response = await POST(new Request(url, { method: 'POST', body: form }), undefined)

    expect(response.status).toBe(400)
  })

  it('recusa tipo que não é áudio', async () => {
    const response = await POST(multipartRequest(url, { name: 'a.pdf', type: 'application/pdf', bytes: new Uint8Array(4) }), undefined)

    expect(response.status).toBe(400)
    expect(fakes.inboxCreate).not.toHaveBeenCalled()
  })

  it('responde 413 acima do limite', async () => {
    fakes.maxUploadBytes = 2

    const response = await POST(multipartRequest(url, audio(10)), undefined)

    expect(response.status).toBe(413)
    expect(fakes.inboxCreate).not.toHaveBeenCalled()
  })

  it('grava o áudio no storage, cria a entrada e enfileira a transcrição', async () => {
    const response = await POST(multipartRequest(url, audio(), { text: 'legenda' }), undefined)

    expect(response.status).toBe(201)
    expect(fakes.inboxCreate.mock.calls[0]![0].data).toMatchObject({
      ownerId: 'user-1',
      source: 'AUDIO',
      status: 'TRANSCRIBING',
      text: 'legenda',
    })
    expect(fakes.jobCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'audio.transcribe',
        payload: expect.objectContaining({ inboxItemId: 'inbox-1', contentType: 'audio/webm' }),
      }),
    }))
    expect(fakes.storage.entries.size).toBe(1)
  })
})
