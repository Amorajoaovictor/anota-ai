import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobRecord } from './queue'

const fakes = vi.hoisted(() => ({
  inboxItem: { findUnique: vi.fn(), update: vi.fn() },
  project: { findMany: vi.fn() },
  projectContext: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  job: { create: vi.fn() },
  classify: vi.fn(),
  transcribe: vi.fn(),
  storageRead: vi.fn(),
  storageDelete: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => ({ inboxItem: fakes.inboxItem, project: fakes.project, projectContext: fakes.projectContext, task: fakes.task, job: fakes.job }),
}))
vi.mock('../ai/config', () => ({
  getAiProviders: () => ({ llm: { classify: fakes.classify }, stt: { transcribe: fakes.transcribe } }),
  readAiEnvironment: () => ({}),
}))
vi.mock('../storage', () => ({
  getStorage: () => ({ read: fakes.storageRead, delete: fakes.storageDelete, put: vi.fn(), list: vi.fn() }),
}))
vi.mock('../audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { resolveHandler } from './handlers'

describe('tipos do pipeline v2', () => {
  /**
   * Protege: jobs encadeados de retrieval/materializacao possuem handlers reais.
   * Detecta: fila aceitar tipo que worker trata como desconhecido.
   * Impacto: run fica preso depois da primeira aprovacao.
   */
  it('resolve ai.retrieve e ai.materialize', () => {
    expect(resolveHandler('ai.retrieve')).toBeTypeOf('function')
    expect(resolveHandler('ai.materialize')).toBeTypeOf('function')
  })
})

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    type: 'ai.classify',
    payload: {},
    status: 'RUNNING',
    attempts: 1,
    maxAttempts: 5,
    runAt: new Date(),
    lockedAt: new Date(),
    lockedBy: 'worker-1',
    lastError: null,
    dedupeKey: null,
    ownerId: null,
    aiRunId: null,
    step: null,
    inputVersion: null,
    inputHash: null,
    priority: 0,
    leaseExpiresAt: null,
    heartbeatAt: null,
    timeoutMs: null,
    cancelledAt: null,
    ...overrides,
  }
}

function resetFakes() {
  fakes.inboxItem.findUnique.mockReset()
  fakes.inboxItem.update.mockReset()
  fakes.project.findMany.mockReset()
  fakes.projectContext.findMany.mockReset().mockResolvedValue([])
  fakes.task.findMany.mockReset()
  fakes.job.create.mockReset()
  fakes.classify.mockReset()
  fakes.transcribe.mockReset()
  fakes.storageRead.mockReset()
  fakes.storageDelete.mockReset()
  fakes.recordAuditEvent.mockReset().mockResolvedValue(undefined)
}

describe('handler ai.classify', () => {
  beforeEach(() => {
    resetFakes()
  })

  it('classifica e grava a sugestão com status Aguardando confirmação', async () => {
    fakes.inboxItem.findUnique.mockResolvedValue({ id: 'inbox-1', ownerId: 'user-1', text: 'Planta travando' })
    fakes.project.findMany.mockResolvedValue([{ id: 'project-1', name: 'VistaFor', aliases: [], modules: [], tags: [] }])
    fakes.task.findMany.mockResolvedValue([])
    const suggestion = { summary: 'x', confidence: 90, evidence: ['x'], actions: [{ id: 'context-1' }] }
    fakes.classify.mockResolvedValue(suggestion)

    const handler = resolveHandler('ai.classify')
    await handler(job({ payload: { inboxItemId: 'inbox-1' } }))

    expect(fakes.inboxItem.update).toHaveBeenCalledWith({
      where: { id: 'inbox-1' },
      data: { suggestion, status: 'AWAITING_CONFIRMATION' },
    })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'inbox.classified' }))
  })

  it('não mexe em nada quando a entrada já sumiu', async () => {
    fakes.inboxItem.findUnique.mockResolvedValue(null)

    const handler = resolveHandler('ai.classify')
    await handler(job({ payload: { inboxItemId: 'inbox-1' } }))

    expect(fakes.classify).not.toHaveBeenCalled()
    expect(fakes.inboxItem.update).not.toHaveBeenCalled()
  })

  it('marca Com erro só na última tentativa', async () => {
    fakes.inboxItem.findUnique.mockResolvedValue({ id: 'inbox-1', ownerId: 'user-1', text: 'x' })
    fakes.project.findMany.mockResolvedValue([])
    fakes.task.findMany.mockResolvedValue([])
    fakes.classify.mockRejectedValue(new Error('falhou'))
    fakes.inboxItem.update.mockResolvedValue({ id: 'inbox-1', status: 'ERROR' })

    const handler = resolveHandler('ai.classify')

    await expect(handler(job({ payload: { inboxItemId: 'inbox-1' }, attempts: 2, maxAttempts: 5 })))
      .rejects.toThrow('falhou')
    expect(fakes.inboxItem.update).not.toHaveBeenCalled()

    await expect(handler(job({ payload: { inboxItemId: 'inbox-1' }, attempts: 5, maxAttempts: 5 })))
      .rejects.toThrow('falhou')
    expect(fakes.inboxItem.update).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'ERROR' } })
  })
})

describe('handler audio.transcribe', () => {
  beforeEach(() => {
    resetFakes()
  })

  it('transcreve, apaga o áudio do storage e encadeia ai.classify', async () => {
    fakes.storageRead.mockResolvedValue(new Uint8Array([1, 2, 3]))
    fakes.transcribe.mockResolvedValue({ text: 'texto transcrito' })
    fakes.inboxItem.findUnique.mockResolvedValue({ text: '' })
    fakes.job.create.mockResolvedValue({ id: 'job-2' })

    const handler = resolveHandler('audio.transcribe')
    await handler(job({
      type: 'audio.transcribe',
      payload: { inboxItemId: 'inbox-1', storageKey: 'inbox-audio/user-1/a', contentType: 'audio/webm' },
    }))

    expect(fakes.inboxItem.update).toHaveBeenCalledWith({
      where: { id: 'inbox-1' },
      data: { text: 'texto transcrito', status: 'ANALYZING' },
    })
    expect(fakes.storageDelete).toHaveBeenCalledWith('inbox-audio/user-1/a')
    expect(fakes.job.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ai.classify', payload: { inboxItemId: 'inbox-1' } }),
    }))
  })

  it('sem provedor de STT configurado, falha e só apaga o áudio na última tentativa', async () => {
    fakes.storageRead.mockResolvedValue(new Uint8Array([1, 2, 3]))
    fakes.transcribe.mockRejectedValue(new Error('Nenhum provedor de transcrição configurado.'))
    fakes.inboxItem.update.mockResolvedValue({ id: 'inbox-1', status: 'ERROR' })
    fakes.storageDelete.mockResolvedValue(undefined)

    const handler = resolveHandler('audio.transcribe')
    const payload = { inboxItemId: 'inbox-1', storageKey: 'inbox-audio/user-1/a', contentType: 'audio/webm' }

    await expect(handler(job({ type: 'audio.transcribe', payload, attempts: 1, maxAttempts: 3 }))).rejects.toThrow()
    expect(fakes.storageDelete).not.toHaveBeenCalled()
    expect(fakes.inboxItem.update).not.toHaveBeenCalled()

    await expect(handler(job({ type: 'audio.transcribe', payload, attempts: 3, maxAttempts: 3 }))).rejects.toThrow()
    expect(fakes.storageDelete).toHaveBeenCalledWith('inbox-audio/user-1/a')
    expect(fakes.inboxItem.update).toHaveBeenCalledWith({ where: { id: 'inbox-1' }, data: { status: 'ERROR' } })
  })
})
