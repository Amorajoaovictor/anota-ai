import { randomUUID } from 'node:crypto'
import type { JobRecord } from '../server/jobs/queue'

/**
 * Repositórios em memória no formato que `src/server/*.ts` espera por injeção.
 * Cobrem só as consultas realmente usadas — não são um emulador do Prisma.
 */

type FakeProject = { id: string; ownerId: string }
type FakeTask = { id: string; projectId: string }
type FakeAttachment = {
  id: string
  projectId: string | null
  taskId: string | null
  storageKey: string
  filename: string
  contentType: string
  sizeBytes: number
}

export function createFakeContentStore(seed: { projects?: FakeProject[]; tasks?: FakeTask[] } = {}) {
  const projects: FakeProject[] = [...(seed.projects ?? [])]
  const tasks: FakeTask[] = [...(seed.tasks ?? [])]
  const attachments: FakeAttachment[] = []
  let failNextCreate: Error | null = null

  const ownerOf = (attachment: FakeAttachment) => {
    const project = attachment.projectId
      ? projects.find((item) => item.id === attachment.projectId)
      : projects.find((item) => item.id === tasks.find((task) => task.id === attachment.taskId)?.projectId)
    return project?.ownerId
  }

  return {
    projects,
    tasks,
    attachments,
    failCreateOnce(error: Error) {
      failNextCreate = error
    },
    project: {
      async findFirst({ where }: any) {
        return projects.find((item) => item.id === where.id && item.ownerId === where.ownerId) ?? null
      },
    },
    task: {
      async findFirst({ where }: any) {
        const task = tasks.find((item) => item.id === where.id)
        if (!task) return null
        const project = projects.find((item) => item.id === task.projectId)
        return project?.ownerId === where.project.ownerId ? { id: task.id } : null
      },
    },
    attachment: {
      async create({ data }: any) {
        if (failNextCreate) {
          const error = failNextCreate
          failNextCreate = null
          throw error
        }
        const attachment: FakeAttachment = { id: randomUUID(), ...data }
        attachments.push(attachment)
        return attachment
      },
      async findFirst({ where }: any) {
        const ownerId = where.OR[0].project.ownerId
        const found = attachments.find((item) => item.id === where.id && ownerOf(item) === ownerId)
        return found ?? null
      },
      async delete({ where }: any) {
        const index = attachments.findIndex((item) => item.id === where.id)
        if (index >= 0) attachments.splice(index, 1)
        return { id: where.id }
      },
    },
  }
}

export function createFakeJobStore(seed: Partial<JobRecord>[] = []) {
  const jobs: JobRecord[] = seed.map(buildJob)

  const matches = (job: JobRecord, where: any): boolean => {
    if (where.id) {
      if (typeof where.id === 'string' && job.id !== where.id) return false
      if (where.id?.notIn && where.id.notIn.includes(job.id)) return false
    }
    if (where.status && job.status !== where.status) return false
    if (where.runAt?.lte && job.runAt > where.runAt.lte) return false
    if (where.lockedAt?.lt && !(job.lockedAt && job.lockedAt < where.lockedAt.lt)) return false
    if (where.leaseExpiresAt === null && job.leaseExpiresAt !== null) return false
    if (where.leaseExpiresAt?.lt && !(job.leaseExpiresAt && job.leaseExpiresAt < where.leaseExpiresAt.lt)) return false
    if (where.lockedBy && job.lockedBy !== where.lockedBy) return false
    if (where.cancelledAt === null && job.cancelledAt !== null) return false
    if (where.dedupeKey !== undefined && job.dedupeKey !== where.dedupeKey) return false
    return true
  }

  const apply = (job: JobRecord, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in (value as object)) {
        ;(job as any)[key] = ((job as any)[key] ?? 0) + (value as { increment: number }).increment
      } else {
        ;(job as any)[key] = value
      }
    }
  }

  return {
    jobs,
    job: {
      async create({ data }: any) {
        if (data.dedupeKey && jobs.some((job) => job.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        }
        const job = buildJob(data)
        jobs.push(job)
        return { ...job }
      },
      async findUnique({ where }: any) {
        const found = jobs.find((job) => matches(job, where))
        return found ? { ...found } : null
      },
      async findFirst({ where, orderBy }: any) {
        const found = jobs.filter((job) => matches(job, where))
        if (Array.isArray(orderBy)) {
          found.sort((a, b) => (b.priority - a.priority) || (a.runAt.getTime() - b.runAt.getTime()))
        } else if (orderBy?.runAt === 'asc') found.sort((a, b) => a.runAt.getTime() - b.runAt.getTime())
        // Prisma devolve cópias; retornar a referência viva esconderia mutações concorrentes.
        return found[0] ? { ...found[0] } : null
      },
      async update({ where, data }: any) {
        const job = jobs.find((item) => item.id === where.id)
        if (!job) throw new Error(`Job inexistente: ${where.id}`)
        apply(job, data)
        return { ...job }
      },
      async updateMany({ where, data }: any) {
        const found = jobs.filter((job) => matches(job, where))
        found.forEach((job) => apply(job, data))
        return { count: found.length }
      },
    },
  }
}

function buildJob(data: Partial<JobRecord>): JobRecord {
  return {
    id: data.id ?? randomUUID(),
    type: data.type ?? 'reminder.dispatch',
    payload: data.payload ?? {},
    status: data.status ?? 'PENDING',
    attempts: data.attempts ?? 0,
    maxAttempts: data.maxAttempts ?? 5,
    runAt: data.runAt ?? new Date(),
    lockedAt: data.lockedAt ?? null,
    lockedBy: data.lockedBy ?? null,
    lastError: data.lastError ?? null,
    dedupeKey: data.dedupeKey ?? null,
    ownerId: data.ownerId ?? null,
    aiRunId: data.aiRunId ?? null,
    step: data.step ?? null,
    inputVersion: data.inputVersion ?? null,
    inputHash: data.inputHash ?? null,
    priority: data.priority ?? 0,
    leaseExpiresAt: data.leaseExpiresAt ?? null,
    heartbeatAt: data.heartbeatAt ?? null,
    timeoutMs: data.timeoutMs ?? null,
    cancelledAt: data.cancelledAt ?? null,
  }
}
