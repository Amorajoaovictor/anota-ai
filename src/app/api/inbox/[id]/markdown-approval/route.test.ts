import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest } from '../../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getHarnessReadModel: vi.fn(),
  approveMarkdownSnapshot: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/ai/harness/read-model', () => ({ getHarnessReadModel: fakes.getHarnessReadModel }))
vi.mock('../../../../../server/ai/harness/approvals', () => ({ approveMarkdownSnapshot: fakes.approveMarkdownSnapshot }))

import { POST } from './route'

const url = 'http://localhost/api/inbox/inbox-1/markdown-approval'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })

describe('POST /api/inbox/[id]/markdown-approval', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.getHarnessReadModel.mockReset().mockResolvedValue({ kind: 'found', harness: { id: 'run-1' } })
    fakes.approveMarkdownSnapshot.mockReset().mockResolvedValue({
      kind: 'approved', approval: { id: 'approval-1', targetId: 'markdown-2', targetHash: 'hash-2' },
    })
  })

  /**
   * Protege: aprovacao usa revisionId, hash e expectedVersion exatos.
   * Detecta: botao aprovar mirando apenas run mutavel.
   * Impacto: LLM 2 usa texto diferente do que usuario leu.
   */
  it('responde 409 para hash divergente', async () => {
    fakes.approveMarkdownSnapshot.mockResolvedValueOnce({ kind: 'hash-mismatch' })
    const response = await POST(jsonRequest(url, { revisionId: 'markdown-2', targetHash: 'old', expectedVersion: 4 }), context())
    expect(response.status).toBe(409)
  })

  it('aprova uma vez e trata repeticao como 200', async () => {
    const body = { revisionId: 'markdown-2', targetHash: 'hash-2', expectedVersion: 4 }
    expect((await POST(jsonRequest(url, body), context())).status).toBe(201)

    fakes.approveMarkdownSnapshot.mockResolvedValueOnce({ kind: 'already-approved', approval: { id: 'approval-1' } })
    expect((await POST(jsonRequest(url, body), context())).status).toBe(200)
  })

  /**
   * Protege: aprovação 1 só libera Markdown inteiro que caiba com referências e saída da LLM 2.
   * Detecta: aceite por caracteres seguido de truncamento ou falha inevitável na materialização.
   * Impacto: usuário aprova conteúdo que nunca consegue avançar e pode perder uma decisão ao dividir tarde.
   */
  it('rejeita Markdown acima do orçamento da materialização sem enfileirar', async () => {
    fakes.getHarnessReadModel.mockResolvedValueOnce({
      kind: 'found',
      harness: {
        id: 'run-1',
        markdown: { id: 'markdown-2', contentHash: 'hash-2', content: 'decisão '.repeat(50_000) },
      },
    })

    const response = await POST(jsonRequest(url, {
      revisionId: 'markdown-2', targetHash: 'hash-2', expectedVersion: 4,
    }), context())

    expect(response.status).toBe(422)
    expect(fakes.approveMarkdownSnapshot).not.toHaveBeenCalled()
  })
})
