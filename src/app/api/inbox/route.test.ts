import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  inboxFindMany: vi.fn(),
  inboxCreate: vi.fn(),
  jobCreate: vi.fn(),
  harnessEnabled: false,
  ownerAllowed: true,
  isHarnessEnabledForOwner: vi.fn(),
  captureHarnessText: vi.fn(),
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
vi.mock('../../../server/ai/harness/config', () => ({
  readHarnessV2Config: () => ({
    enabled: fakes.harnessEnabled,
    ownerAllowlist: [],
    maxProposalItems: 100,
    maxMarkdownCharacters: 50_000,
    maxAudioBytes: 1024,
    timeouts: { organizationMs: 45_000 },
  }),
  isHarnessEnabledForOwner: fakes.isHarnessEnabledForOwner,
}))
vi.mock('../../../server/ai/harness/capture', () => ({ captureHarnessText: fakes.captureHarnessText }))

import { GET, POST } from './route'

const url = 'http://localhost/api/inbox'
const post = (body: unknown) => POST(jsonRequest(url, body), undefined)

describe('rotas da caixa de entrada', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.inboxFindMany.mockReset().mockResolvedValue([{ id: 'inbox-1' }])
    fakes.inboxCreate.mockReset().mockResolvedValue({ id: 'inbox-1', text: 'Ligar para o PAX' })
    fakes.jobCreate.mockReset().mockResolvedValue({ id: 'job-1' })
    fakes.harnessEnabled = false
    fakes.ownerAllowed = true
    fakes.isHarnessEnabledForOwner.mockReset().mockImplementation(() => fakes.harnessEnabled && fakes.ownerAllowed)
    fakes.captureHarnessText.mockReset().mockResolvedValue({
      kind: 'created',
      inboxItem: { id: 'inbox-v2', text: 'Fluxo novo' },
      aiRun: { id: 'run-1', status: 'TRANSCRIBED' },
      transcript: { id: 'transcript-1' },
    })
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
    expect(fakes.inboxFindMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      include: { aiRuns: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    })
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

  /**
   * Protege: flag habilitada direciona nova captura ao harness sem ai.classify e marca a resposta como v2.
   * Detecta: front v2 alimentado pelo fluxo legado ou recebendo item sem vínculo para abrir revisão correta.
   * Impacto: criação sem dois checkpoints humanos ou erro falso ao abrir processamento.
   */
  it('usa captura versionada quando feature flag v2 esta habilitada', async () => {
    fakes.harnessEnabled = true

    const response = await post({ text: 'Fluxo novo' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      inboxItem: { id: 'inbox-v2', text: 'Fluxo novo', aiRuns: [{ id: 'run-1' }] },
      aiRun: { id: 'run-1', status: 'TRANSCRIBED' },
    })
    expect(fakes.captureHarnessText).toHaveBeenCalledWith(expect.anything(), 'user-1', { text: 'Fluxo novo' }, expect.anything())
    expect(fakes.isHarnessEnabledForOwner).toHaveBeenCalledWith(expect.anything(), 'user-1')
    expect(fakes.jobCreate).not.toHaveBeenCalled()
  })

  /**
   * Protege: flag global nao inclui owner fora da allowlist.
   * Detecta: rota consultando apenas config.enabled.
   * Impacto: rollout atinge conta nao aprovada.
   */
  it('mantem fluxo legado para owner fora da allowlist', async () => {
    fakes.harnessEnabled = true
    fakes.ownerAllowed = false

    const response = await post({ text: 'Ainda legado' })

    expect(response.status).toBe(201)
    expect(fakes.captureHarnessText).not.toHaveBeenCalled()
    expect(fakes.jobCreate).toHaveBeenCalled()
  })
})
