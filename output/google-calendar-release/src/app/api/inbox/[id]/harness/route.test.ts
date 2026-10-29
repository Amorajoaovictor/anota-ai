import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../../server/http'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getHarnessReadModel: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/ai/harness/read-model', () => ({ getHarnessReadModel: fakes.getHarnessReadModel }))

import { GET } from './route'

const request = () => new Request('http://localhost/api/inbox/inbox-1/harness')
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })

describe('GET /api/inbox/[id]/harness', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.getHarnessReadModel.mockReset().mockResolvedValue({
      kind: 'found', harness: { id: 'run-1', status: 'AWAITING_MARKDOWN_APPROVAL', permissions: {} },
    })
  })

  /**
   * Protege: estado do harness exige sessao e owner resolvido no servidor.
   * Detecta: endpoint aceitando ownerId do cliente ou revelando existencia alheia.
   * Impacto: exposicao de transcricao, Markdown e proposta.
   */
  it('responde 401 sem sessao e 404 para recurso invisivel', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())
    expect((await GET(request(), context())).status).toBe(401)

    fakes.getHarnessReadModel.mockResolvedValueOnce({ kind: 'not-found' })
    expect((await GET(request(), context())).status).toBe(404)
  })

  it('devolve read model persistido do dono', async () => {
    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ harness: { id: 'run-1', status: 'AWAITING_MARKDOWN_APPROVAL' } })
    expect(fakes.getHarnessReadModel).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'inbox-1')
  })
})
