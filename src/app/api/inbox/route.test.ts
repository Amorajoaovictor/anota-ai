import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  inboxFindMany: vi.fn(),
  inboxCreate: vi.fn(),
  jobCreate: vi.fn(),
  drainJobs: vi.fn().mockResolvedValue({ claimed: 0, completed: 0, failed: 0, released: 0 }),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({
    inboxItem: { findMany: fakes.inboxFindMany, create: fakes.inboxCreate },
    job: { create: fakes.jobCreate },
  }),
}))
vi.mock('../../../server/jobs/runner', () => ({ drainJobs: fakes.drainJobs }))

import { GET, POST } from './route'

const url = 'http://localhost/api/inbox'
const post = (body: unknown) => POST(jsonRequest(url, body), undefined)

describe('rotas da caixa de entrada', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.inboxFindMany.mockReset().mockResolvedValue([{ id: 'inbox-1' }])
    fakes.inboxCreate.mockReset().mockResolvedValue({ id: 'inbox-1', text: 'Ligar para o PAX' })
    fakes.jobCreate.mockReset().mockResolvedValue({ id: 'job-1' })
    fakes.drainJobs.mockClear()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(401)
  })

  it('lista a caixa de entrada do dono', async () => {
    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ inbox: [{ id: 'inbox-1' }] })
    expect(fakes.inboxFindMany).toHaveBeenCalledWith({ where: { ownerId: 'user-1' }, orderBy: { createdAt: 'desc' } })
  })

  it('responde 400 para texto vazio, sem gravar nem enfileirar', async () => {
    const response = await post({ text: '   ' })

    expect(response.status).toBe(400)
    expect(fakes.inboxCreate).not.toHaveBeenCalled()
    expect(fakes.jobCreate).not.toHaveBeenCalled()
  })

  it('captura o texto, enfileira a classificação e dispara o drain inline', async () => {
    const response = await post({ text: 'Ligar para o PAX' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ inboxItem: { id: 'inbox-1', text: 'Ligar para o PAX' } })
    expect(fakes.jobCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ai.classify', payload: { inboxItemId: 'inbox-1' } }),
    }))
    expect(fakes.drainJobs).toHaveBeenCalled()
  })

  it('falha no drain inline não derruba a resposta', async () => {
    fakes.drainJobs.mockRejectedValueOnce(new Error('worker fora do ar'))

    const response = await post({ text: 'Ligar para o PAX' })

    expect(response.status).toBe(201)
  })
})
