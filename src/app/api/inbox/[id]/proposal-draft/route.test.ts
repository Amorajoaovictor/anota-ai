import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest } from '../../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getHarnessReadModel: vi.fn(),
  appendUserProposalRevision: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/ai/harness/read-model', () => ({ getHarnessReadModel: fakes.getHarnessReadModel }))
vi.mock('../../../../../server/ai/harness/proposal-persistence', () => ({ appendUserProposalRevision: fakes.appendUserProposalRevision }))

import { PUT } from './route'

const url = 'http://localhost/api/inbox/inbox-1/proposal-draft'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })
const proposal = { schemaVersion: 1, summary: 'Sem acao', items: [], unresolved: [{ topicId: 'topic-1', reason: 'Ambiguo', evidence: [{ quote: 'talvez' }] }] }

describe('PUT /api/inbox/[id]/proposal-draft', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.getHarnessReadModel.mockReset().mockResolvedValue({ kind: 'found', harness: { id: 'run-1' } })
    fakes.appendUserProposalRevision.mockReset().mockResolvedValue({
      kind: 'created', revision: { id: 'proposal-2', version: 2, contentHash: 'hash-2' },
    })
  })

  /**
   * Protege: corpo exige versao, proposta e IDs selecionados.
   * Detecta: payload parcial ou campos ocultos chegando a persistencia.
   * Impacto: preview divergente do snapshot executado.
   */
  it('responde 400 para contrato invalido e 422 para grafo sem dependencia', async () => {
    expect((await PUT(jsonRequest(url, { proposal }), context())).status).toBe(400)
    fakes.appendUserProposalRevision.mockResolvedValueOnce({ kind: 'invalid', issues: ['dependencia ausente'] })
    expect((await PUT(jsonRequest(url, { expectedVersion: 8, proposal, selectedItemIds: [] }), context())).status).toBe(422)
  })

  it('persiste nova revisao USER', async () => {
    const response = await PUT(jsonRequest(url, { expectedVersion: 8, proposal, selectedItemIds: [] }), context())
    expect(response.status).toBe(201)
    expect(fakes.appendUserProposalRevision).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'run-1', {
      expectedVersion: 8, proposal, selectedItemIds: [],
    })
  })

  it('responde 409 para versao obsoleta', async () => {
    fakes.appendUserProposalRevision.mockResolvedValueOnce({ kind: 'stale-version' })
    expect((await PUT(jsonRequest(url, { expectedVersion: 8, proposal, selectedItemIds: [] }), context())).status).toBe(409)
  })
})
