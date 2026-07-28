import { describe, expect, it, vi } from 'vitest'
import { listMilestones } from './milestones'

describe('marcos em leitura', () => {
  it('lê só marcos de projetos do dono, com nome e cor do projeto', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listMilestones({ milestone: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { project: { ownerId: 'user-1' } },
      orderBy: { targetAt: 'asc' },
      include: { project: { select: { name: true, color: true } } },
    })
  })
})
