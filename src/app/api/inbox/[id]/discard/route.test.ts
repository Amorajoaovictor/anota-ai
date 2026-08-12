import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  discardHarnessRun: vi.fn(),
  storage: {},
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/storage', () => ({ getStorage: () => fakes.storage }))
vi.mock('../../../../../server/ai/harness/orchestration', () => ({ discardHarnessRun: fakes.discardHarnessRun }))

import { POST } from './route'

describe('POST /api/inbox/[id]/discard', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.discardHarnessRun.mockReset().mockResolvedValue({
      kind: 'discarded', run: { id: 'run-1', status: 'DISCARDED' }, audioCleanupFailures: 0,
    })
  })

  /**
   * H15 protege: descarte owner-scoped usa servico que cancela jobs e limpa audio.
   * Detecta: rota alterando apenas InboxItem legado.
   * Impacto: worker v2 continua e dado descartado reaparece.
   */
  it('descarta run e devolve resultado de cleanup', async () => {
    const response = await POST(new Request('http://localhost/api/inbox/inbox-1/discard', { method: 'POST' }), {
      params: Promise.resolve({ id: 'inbox-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      run: { id: 'run-1', status: 'DISCARDED' }, audioCleanupFailures: 0,
    })
    expect(fakes.discardHarnessRun).toHaveBeenCalledWith(expect.anything(), fakes.storage, 'owner-1', 'inbox-1')
  })

  it('responde 409 depois de run processado', async () => {
    fakes.discardHarnessRun.mockResolvedValueOnce({ kind: 'not-allowed' })
    const response = await POST(new Request('http://localhost/api/inbox/inbox-1/discard', { method: 'POST' }), {
      params: Promise.resolve({ id: 'inbox-1' }),
    })
    expect(response.status).toBe(409)
  })
})
