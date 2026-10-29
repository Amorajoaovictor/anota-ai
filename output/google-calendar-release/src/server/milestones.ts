/**
 * Somente leitura por enquanto. O vínculo card↔marco é gravado pela Fase 3, em
 * `updateTask`/`createTask`, mas criar, editar e remover marco é Fase 5 do PRD.
 */

type MilestoneListRepository = {
  milestone: { findMany(args: any): Promise<unknown> }
}

export async function listMilestones(repository: MilestoneListRepository, ownerId: string) {
  return repository.milestone.findMany({
    where: { project: { ownerId } },
    orderBy: { targetAt: 'asc' },
    include: { project: { select: { name: true, color: true } } },
  })
}
