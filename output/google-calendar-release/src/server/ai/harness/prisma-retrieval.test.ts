import { describe, expect, it, vi } from 'vitest'
import { PrismaRetrievalProvider } from './prisma-retrieval'

describe('adapter PostgreSQL da recuperacao', () => {
  /**
   * Protege: exact/full-text sempre nascem de consultas filtradas pelo owner.
   * Detecta: uma fonte nova sem filtro ou inclusao acidental de Note.
   * Impacto: prompt da LLM 2 recebe dados de outra conta ou nota privada.
   */
  it('consulta somente fontes elegiveis e devolve snapshot ranqueado', async () => {
    const repository: any = {
      project: { findMany: vi.fn().mockResolvedValue([{ id: 'project-1', ownerId: 'owner-1', name: 'Aurora', updatedAt: new Date('2026-07-31T12:00:00Z') }]) },
      projectAlias: { findMany: vi.fn().mockResolvedValue([]) },
      projectModule: { findMany: vi.fn().mockResolvedValue([]) },
      projectTag: { findMany: vi.fn().mockResolvedValue([]) },
      note: { findMany: vi.fn(() => { throw new Error('Note nunca deve ser consultada') }) },
      $queryRaw: vi.fn().mockResolvedValue([{
        id: 'task-1', kind: 'TASK', projectId: 'project-1', title: 'Revisar acesso', content: 'Revisar acesso do Aurora', updatedAt: new Date('2026-07-31T13:00:00Z'),
      }]),
    }

    const result = await new PrismaRetrievalProvider(repository).retrieve({
      ownerId: 'owner-1', topics: [{ id: 'topic-1', text: 'Aurora' }], limits: { perTopic: 10, perType: 5 },
    })

    expect(repository.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1', status: 'ACTIVE' } }))
    expect(repository.$queryRaw).toHaveBeenCalled()
    expect(repository.note.findMany).not.toHaveBeenCalled()
    expect(result.references.map((reference) => reference.id)).toContain('project-1')
    expect(result.references.every((reference) => !String(reference.type).includes('NOTE'))).toBe(true)
  })
})
