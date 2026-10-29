import { describe, expect, it, vi } from 'vitest'
import { enqueue } from '../../jobs/queue'

describe('metadados v2 na fila', () => {
  /**
   * Protege: job carrega proprietário, run, etapa, versão e hash do snapshot.
   * Detecta: enqueue descartando metadados necessários para stale result e auditoria.
   * Impacto: worker pode aplicar resultado antigo ou sem isolamento rastreável.
   */
  it('persiste metadados do harness ao enfileirar', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'job-1' })
    const repository: any = { job: { create, findUnique: vi.fn() } }

    await enqueue(repository, {
      type: 'ai.organize',
      payload: { markdownRevisionId: 'markdown-1' },
      ownerId: 'owner-1',
      aiRunId: 'run-1',
      step: 'ORGANIZING',
      inputVersion: 3,
      inputHash: 'hash-1',
      priority: 10,
      timeoutMs: 45_000,
    })

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      ownerId: 'owner-1',
      aiRunId: 'run-1',
      step: 'ORGANIZING',
      inputVersion: 3,
      inputHash: 'hash-1',
      priority: 10,
      timeoutMs: 45_000,
    }) })
  })
})
