import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest } from '../../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getHarnessReadModel: vi.fn(),
  createRepository: vi.fn(),
  start: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({ prisma: true }) }))
vi.mock('../../../../../server/ai/harness/read-model', () => ({ getHarnessReadModel: fakes.getHarnessReadModel }))
vi.mock('../../../../../server/ai/harness/prisma-executor', () => ({ createPrismaHarnessExecutionRepository: fakes.createRepository }))
vi.mock('../../../../../server/ai/harness/executor', () => ({ startApprovedHarnessProposal: fakes.start }))

import { POST } from './route'

const url = 'http://localhost/api/inbox/inbox-1/execution'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })
const body = { proposalRevisionId: 'proposal-1', targetHash: 'hash-1', expectedVersion: 7, selectedItemIds: ['task-1'] }

describe('POST /api/inbox/[id]/execution', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.getHarnessReadModel.mockReset().mockResolvedValue({ kind: 'found', harness: { id: 'run-1' } })
    fakes.createRepository.mockReset().mockReturnValue({ repository: true })
    fakes.start.mockReset().mockResolvedValue({ kind: 'started', executionId: 'execution-1', entityIds: [] })
  })

  /**
   * Protege: owner vem da sessão e payload é strict.
   * Detecta: ownerId ou campos ocultos aceitos do cliente.
   * Impacto: execução cruzada ou diferente do preview.
   */
  it('rejeita payload oculto e usa owner autenticado', async () => {
    expect((await POST(jsonRequest(url, { ...body, ownerId: 'owner-2' }), context())).status).toBe(400)
    expect(fakes.start).not.toHaveBeenCalled()

    const response = await POST(jsonRequest(url, body), context())
    expect(response.status).toBe(202)
    expect(fakes.start).toHaveBeenCalledWith({ repository: true }, {
      ownerId: 'owner-1', aiRunId: 'run-1', proposalRevisionId: 'proposal-1', targetHash: 'hash-1',
      selectedItemIds: ['task-1'], expectedRunVersion: 7,
    })
  })

  /**
   * Protege: uma proposta totalmente UNRESOLVED pode ser aprovada sem criar entidades.
   * Detecta: validação HTTP volta a exigir pelo menos um item selecionado.
   * Impacto: capturas válidas ficam presas na segunda aprovação e nunca chegam a PROCESSED.
   */
  it('aceita aprovação sem itens selecionados', async () => {
    fakes.start.mockResolvedValueOnce({ kind: 'started', executionId: 'execution-1', entityIds: [] })

    const response = await POST(jsonRequest(url, { ...body, selectedItemIds: [] }), context())

    expect(response.status).toBe(202)
    expect(fakes.start).toHaveBeenCalledWith({ repository: true }, expect.objectContaining({
      selectedItemIds: [],
    }))
  })

  it('devolve execução idempotente com 200', async () => {
    fakes.start.mockResolvedValueOnce({ kind: 'already-executed', executionId: 'execution-1', entityIds: ['task-1'] })
    const response = await POST(jsonRequest(url, body), context())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ executionId: 'execution-1', entityIds: ['task-1'] })
  })

  it('mapeia ausência, conflito e proposta inconsistente', async () => {
    fakes.getHarnessReadModel.mockResolvedValueOnce({ kind: 'not-found' })
    expect((await POST(jsonRequest(url, body), context())).status).toBe(404)

    fakes.start.mockResolvedValueOnce({ kind: 'blocked', code: 'REFERENCE_STALE' })
    expect((await POST(jsonRequest(url, body), context())).status).toBe(409)

    fakes.start.mockResolvedValueOnce({ kind: 'blocked', code: 'INVALID_GRAPH' })
    expect((await POST(jsonRequest(url, body), context())).status).toBe(422)
  })
})
