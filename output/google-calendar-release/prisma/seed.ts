import { getPrisma } from '../src/lib/prisma'
import { seedDemo } from '../src/server/demo-seed'

/**
 * Grava a base de demonstração completa para um dono.
 * Idempotente: reexecutar atualiza os mesmos registros, sem duplicar nem apagar.
 */

const prisma = getPrisma()

async function resolveOwnerId() {
  const fromEnv = process.env.SEED_OWNER_ID?.trim()
  if (fromEnv) return { ownerId: fromEnv, origin: 'SEED_OWNER_ID' }

  const existing = await prisma.project.findFirst({
    select: { ownerId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return { ownerId: existing.ownerId, origin: 'primeiro dono presente no banco' }

  throw new Error(
    'Nenhum dono encontrado. Defina SEED_OWNER_ID no .env.local com o id do usuário do Neon Auth ' +
    '(o mesmo que requireCurrentUserId devolve na sessão).',
  )
}

async function main() {
  const { ownerId, origin } = await resolveOwnerId()
  console.log(`Semeando para ownerId=${ownerId} (${origin})`)
  const result = await seedDemo(prisma, ownerId)
  console.log(
    `Projetos: ${result.projects.total} (${result.projects.created} criados) · ` +
    `Cards: ${result.tasks.total} (${result.tasks.created} criados) · ` +
    `Marcos: ${result.milestones.total} (${result.milestones.created} criados) · ` +
    `Notas: ${result.notes.total} (${result.notes.created} criadas) · ` +
    `Contextos: ${result.contexts.total} (${result.contexts.created} criados) · ` +
    `Inbox: ${result.inbox.total} (${result.inbox.created} criados) · ` +
    `Etiquetas: ${result.tags} · Dependências: ${result.dependencies} · ` +
    `Vínculos card-marco: ${result.milestoneLinks} · Vínculos card-etiqueta: ${result.tagLinks}`,
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
