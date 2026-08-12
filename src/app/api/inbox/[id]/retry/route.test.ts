import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  retryHarnessRun: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/ai/harness/orchestration', () => ({ retryHarnessRun: fakes.retryHarnessRun }))

import { POST } from './route'

describe('POST /api/inbox/[id]/retry', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.retryHarnessRun.mockReset().mockResolvedValue({
      kind: 'retried', run: { id: 'run-1', status: 'ORGANIZING' }, job: { id: 'job-2' },
    })
  })

  /**
   * H12 protege: rota delega retry owner-scoped e devolve snapshot/job clonado.
   * Detecta: endpoint criando job livre a partir de body do cliente.
   * Impacto: retry pode processar outro conteudo ou outra conta.
   */
  it('repete run do dono sem aceitar payload de snapshot', async () => {
    const response = await POST(new Request('http://localhost/api/inbox/inbox-1/retry', { method: 'POST' }), {
      params: Promise.resolve({ id: 'inbox-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ run: { id: 'run-1', status: 'ORGANIZING' }, job: { id: 'job-2' } })
    expect(fakes.retryHarnessRun).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'inbox-1')
  })

  it('responde 409 quando run nao aceita retry', async () => {
    fakes.retryHarnessRun.mockResolvedValueOnce({ kind: 'not-retryable' })
    const response = await POST(new Request('http://localhost/api/inbox/inbox-1/retry', { method: 'POST' }), {
      params: Promise.resolve({ id: 'inbox-1' }),
    })
    expect(response.status).toBe(409)
  })
})
