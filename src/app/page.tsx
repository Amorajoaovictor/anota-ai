import { redirect } from 'next/navigation'
import App from '../App'
import { requireCurrentUser } from '../lib/auth/server'
import { toAppState, type DbContext, type DbInboxItem, type DbMilestone, type DbNote, type DbProject, type DbTask } from '../lib/mapping'
import { getPrisma } from '../lib/prisma'
import { listContexts } from '../server/contexts'
import { UnauthorizedError } from '../server/http'
import { listInboxItems } from '../server/inbox'
import { listMilestones } from '../server/milestones'
import { listNotes } from '../server/notes'
import { listProjects } from '../server/projects'
import { listTasks } from '../server/tasks'

export const dynamic = 'force-dynamic'

/**
 * Carga inicial no servidor: as telas nascem com os dados do dono, sem piscar
 * vazio esperando um fetch do cliente. As escritas seguem pela API.
 */
export default async function HomePage() {
  let user: Awaited<ReturnType<typeof requireCurrentUser>>
  try {
    user = await requireCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/auth/sign-in')
    throw error
  }
  const ownerId = user.id

  const prisma = getPrisma()
  const [projects, tasks, milestones, notes, contexts, inbox] = await Promise.all([
    listProjects(prisma, ownerId),
    listTasks(prisma, ownerId),
    listMilestones(prisma, ownerId),
    listNotes(prisma, ownerId),
    listContexts(prisma, ownerId),
    listInboxItems(prisma, ownerId),
  ])

  return <App
    initialState={toAppState(
      projects as DbProject[],
      tasks as DbTask[],
      milestones as DbMilestone[],
      notes as DbNote[],
      contexts as DbContext[],
      inbox as DbInboxItem[],
    )}
    user={user}
  />
}
