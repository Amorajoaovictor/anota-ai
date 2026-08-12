import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest } from '../../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getHarnessReadModel: vi.fn(),
  appendMarkdownRevision: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../../server/ai/harness/read-model', () => ({ getHarnessReadModel: fakes.getHarnessReadModel }))
vi.mock('../../../../../server/ai/harness/persistence', () => ({ appendMarkdownRevision: fakes.appendMarkdownRevision }))
vi.mock('../../../../../server/ai/harness/config', () => ({
  readHarnessV2Config: () => ({ enabled: true, maxProposalItems: 100, maxMarkdownCharacters: 50_000 }),
}))

import { PUT } from './route'

const url = 'http://localhost/api/inbox/inbox-1/markdown-draft'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })

describe('PUT /api/inbox/[id]/markdown-draft', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.getHarnessReadModel.mockReset().mockResolvedValue({ kind: 'found', harness: { id: 'run-1' } })
    fakes.appendMarkdownRevision.mockReset().mockResolvedValue({
      kind: 'created', revision: { id: 'markdown-3', version: 3, content: '# Editado', contentHash: 'hash-3' },
    })
  })

  /**
   * Protege: autosave exige conteudo valido e expectedVersion.
   * Detecta: sobrescrita last-write-wins entre duas abas.
   * Impacto: edicao humana aprovada pode desaparecer.
   */
  it('responde 400 para draft invalido e 409 para versao obsoleta', async () => {
    expect((await PUT(jsonRequest(url, { content: '' }), context())).status).toBe(400)

    fakes.appendMarkdownRevision.mockResolvedValueOnce({ kind: 'stale-version' })
    expect((await PUT(jsonRequest(url, { content: '# X', expectedVersion: 2 }), context())).status).toBe(409)
  })

  it('cria revisao USER e devolve hash canonico', async () => {
    const response = await PUT(jsonRequest(url, { content: '# Editado', expectedVersion: 2 }), context())

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ revision: { id: 'markdown-3', contentHash: 'hash-3' } })
    expect(fakes.appendMarkdownRevision).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'run-1', {
      expectedVersion: 2, source: 'USER', content: '# Editado', tokenCount: 9,
    })
  })
})
