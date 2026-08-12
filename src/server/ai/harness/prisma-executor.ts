import type { HarnessProposalV1 } from './contracts'
import type {
  HarnessExecutionRepository,
  HarnessExecutionStepJob,
  HarnessExecutionTransaction,
  HarnessReferenceRecord,
  MaterializedEntity,
} from './executor'
import { enqueue } from '../../jobs/queue'
import type { ExistingProposalReference } from './materialization'
import type { RetrievalReferenceType } from './retrieval'

type PrismaClientLike = {
  $transaction<T>(callback: (transaction: any) => Promise<T>, options?: { isolationLevel?: 'Serializable'; timeout?: number }): Promise<T>
}

const MAX_TRANSACTION_ATTEMPTS = 3

export function createPrismaHarnessExecutionRepository(prisma: PrismaClientLike): HarnessExecutionRepository {
  return {
    async transaction<T>(callback: (transaction: HarnessExecutionTransaction) => Promise<T>): Promise<T> {
      let lastError: unknown
      for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
          return await prisma.$transaction(
            (transaction) => callback(createPrismaExecutionTransaction(transaction)),
            { isolationLevel: 'Serializable', timeout: 30_000 },
          )
        } catch (error) {
          lastError = error
          if (!isRetryableTransactionConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error
        }
      }
      throw lastError
    },
  }
}

export function createPrismaExecutionTransaction(transaction: any): HarnessExecutionTransaction {
  return {
    async findExecution(idempotencyKey) {
      const execution = await transaction.aiExecution.findUnique({
        where: { idempotencyKey },
        include: { proposalRevision: { include: { items: { include: { origins: true } } } } },
      })
      if (!execution) return null
      const entityIds = execution.proposalRevision?.items
        ?.flatMap((item: any) => item.origins?.map((origin: any) => origin.entityId) ?? []) ?? []
      return {
        id: execution.id,
        aiRunId: execution.aiRunId,
        proposalRevisionId: execution.proposalRevisionId,
        idempotencyKey: execution.idempotencyKey,
        status: execution.status,
        entityIds,
      }
    },

    async findOrigin(proposalItemId) {
      const origin = await transaction.entityOrigin.findFirst({
        where: { proposalItemId },
        select: { proposalItemId: true, entityType: true, entityId: true },
      })
      if (!origin) return null
      return findMaterializedOrigin(transaction, origin)
    },

    async loadContext(ownerId, aiRunId, proposalRevisionId) {
      const proposal = await transaction.proposalRevision.findFirst({
        where: {
          id: proposalRevisionId,
          aiRunId,
          aiRun: { ownerId, activeProposalRevisionId: proposalRevisionId },
        },
        include: {
          markdownRevision: { select: { id: true, contentHash: true } },
          items: { select: { id: true, localKey: true, selected: true } },
          aiRun: {
            select: {
              id: true, ownerId: true, status: true, version: true,
              approvals: { select: { type: true, targetId: true, targetHash: true } },
            },
          },
        },
      })
      if (!proposal) return null
      return {
        ownerId: proposal.aiRun.ownerId,
        run: {
          id: proposal.aiRun.id,
          status: proposal.aiRun.status,
          version: proposal.aiRun.version,
        },
        markdownRevision: proposal.markdownRevision,
        proposalRevision: {
          id: proposal.id,
          contentHash: proposal.contentHash,
          validatedPlan: proposal.validatedPlan,
          selectedItemIds: proposal.items.filter((item: any) => item.selected).map((item: any) => item.localKey),
          proposalItemRecordIds: Object.fromEntries(proposal.items.map((item: any) => [item.localKey, item.id])),
        },
        approvals: proposal.aiRun.approvals,
      }
    },

    findReference(ownerId, reference) {
      return findOwnedReference(transaction, ownerId, reference)
    },

    async approveProposal(input) {
      const now = new Date()
      const approval = await transaction.aiApproval.create({
        data: {
          aiRunId: input.aiRunId,
          ownerId: input.ownerId,
          type: 'ENTITIES',
          targetId: input.proposalRevisionId,
          targetHash: input.targetHash,
          createdAt: now,
        },
      })
      await transaction.proposalRevision.update({
        where: { id: input.proposalRevisionId },
        data: { approvedAt: now },
      })
      return { type: 'ENTITIES', targetId: approval.targetId, targetHash: approval.targetHash }
    },

    async beginRun(aiRunId, ownerId, expectedVersion) {
      const updated = await transaction.aiRun.updateMany({
        where: { id: aiRunId, ownerId, status: 'AWAITING_ENTITY_APPROVAL', version: expectedVersion },
        data: { status: 'EXECUTING' },
      })
      return updated.count === 1
    },

    async createExecution(input) {
      const execution = await transaction.aiExecution.create({
        data: { ...input, startedAt: new Date() },
      })
      return { ...execution, entityIds: [] }
    },

    createItem(ownerId, item, localEntities, existingReferences) {
      return createPrismaProposalItem(transaction, ownerId, item, localEntities, existingReferences)
    },

    async createOrigin(input) {
      await transaction.entityOrigin.create({ data: input })
    },

    async createAudit(input) {
      await transaction.auditLog.create({ data: input })
    },

    async completeExecution(executionId, entityIds) {
      await transaction.aiExecution.update({
        where: { id: executionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      void entityIds
    },

    async completeRun(aiRunId, ownerId, expectedVersion) {
      const updated = await transaction.aiRun.updateMany({
        where: { id: aiRunId, ownerId, status: 'EXECUTING', version: expectedVersion },
        data: { status: 'PROCESSED', processedAt: new Date(), version: { increment: 1 } },
      })
      return updated.count === 1
    },

    async enqueueExecutionStep(input: HarnessExecutionStepJob) {
      await enqueue(transaction, {
        type: 'ai.execute',
        payload: input,
        ownerId: input.ownerId,
        aiRunId: input.aiRunId,
        step: 'EXECUTING',
        inputVersion: input.expectedRunVersion,
        inputHash: input.targetHash,
        priority: 20,
        timeoutMs: 60_000,
        dedupeKey: `execute:${input.executionId}:${input.index}`,
      })
    },
  }
}

async function findMaterializedOrigin(transaction: any, origin: { proposalItemId: string; entityType: string; entityId: string }) {
  let projectId: string | undefined
  if (origin.entityType === 'PROJECT') {
    projectId = origin.entityId
  } else if (origin.entityType === 'TASK') {
    projectId = (await transaction.task.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'MILESTONE') {
    projectId = (await transaction.milestone.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'CONTEXT') {
    projectId = (await transaction.projectContext.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'NOTE') {
    projectId = (await transaction.note.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'MODULE') {
    projectId = (await transaction.projectModule.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'TAG') {
    projectId = (await transaction.projectTag.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'ALIAS') {
    projectId = (await transaction.projectAlias.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId
  } else if (origin.entityType === 'MEETING') {
    projectId = (await transaction.meeting.findUnique({ where: { id: origin.entityId }, select: { projectId: true } }))?.projectId ?? undefined
  }
  return {
    id: origin.entityId,
    entityType: origin.entityType as MaterializedEntity['entityType'],
    proposalItemId: origin.proposalItemId,
    ...(projectId ? { projectId } : {}),
  }
}

async function findOwnedReference(
  transaction: any,
  ownerId: string,
  reference: ExistingProposalReference,
): Promise<HarnessReferenceRecord | null> {
  const select = { id: true, projectId: true }
  let found: any
  switch (reference.expectedType) {
    case 'PROJECT':
      found = await transaction.project.findFirst({
        where: { id: reference.id, ownerId, status: 'ACTIVE' }, select: { id: true },
      })
      return found ? { id: found.id, ownerId, entityType: 'PROJECT', projectId: found.id } : null
    case 'TASK':
      found = await transaction.task.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
    case 'MILESTONE':
      found = await transaction.milestone.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
    case 'CONTEXT':
      found = await transaction.projectContext.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
    case 'ALIAS':
      found = await transaction.projectAlias.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
    case 'MODULE':
      found = await transaction.projectModule.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
    case 'TAG':
      found = await transaction.projectTag.findFirst({ where: { id: reference.id, project: { ownerId } }, select })
      break
  }
  return found ? { id: found.id, ownerId, entityType: reference.expectedType, projectId: found.projectId } : null
}

async function createPrismaProposalItem(
  transaction: any,
  ownerId: string,
  item: HarnessProposalV1['items'][number],
  localEntities: ReadonlyMap<string, MaterializedEntity>,
  existingReferences: ReadonlyMap<string, HarnessReferenceRecord>,
): Promise<MaterializedEntity> {
  if (item.entity === 'PROJECT') {
    const project = await transaction.project.create({ data: { ownerId, name: item.data.name, description: item.data.description ?? '' } })
    return materialized(item, project.id, project.id)
  }

  if (item.entity === 'DEPENDENCY') {
    const task = resolveEntityRef('TASK', item.data.task, localEntities, existingReferences)
    const dependsOn = resolveEntityRef('TASK', item.data.dependsOnTask, localEntities, existingReferences)
    requireSameProject(task, dependsOn, 'Dependência')
    if (task.id === dependsOn.id) throw new Error('Dependência exige tarefas diferentes.')
    await transaction.taskDependency.upsert({
      where: { taskId_dependsOnId: { taskId: task.id, dependsOnId: dependsOn.id } },
      create: { taskId: task.id, dependsOnId: dependsOn.id },
      update: {},
    })
    return materialized(item, `${task.id}:${dependsOn.id}`, task.projectId)
  }

  if (item.entity === 'TASK_MILESTONE') {
    const task = resolveEntityRef('TASK', item.data.task, localEntities, existingReferences)
    const milestone = resolveEntityRef('MILESTONE', item.data.milestone, localEntities, existingReferences)
    requireSameProject(task, milestone, 'Vínculo task/milestone')
    await transaction.taskMilestone.upsert({
      where: { taskId_milestoneId: { taskId: task.id, milestoneId: milestone.id } },
      create: { taskId: task.id, milestoneId: milestone.id },
      update: {},
    })
    return materialized(item, `${task.id}:${milestone.id}`, task.projectId)
  }

  const project = 'project' in item.data && item.data.project
    ? resolveEntityRef('PROJECT', item.data.project, localEntities, existingReferences)
    : undefined

  if (item.entity === 'MEETING') {
    const startsAt = new Date(item.data.startsAt)
    const endsAt = item.data.endsAt ? new Date(item.data.endsAt) : null
    if (endsAt && endsAt <= startsAt) throw new Error('Fim da reunião precisa ser posterior ao início.')
    const meeting = await transaction.meeting.create({ data: {
      ownerId, projectId: project?.id ?? null, title: item.data.title, description: item.data.description ?? '',
      startsAt, endsAt, durationMinutes: item.data.durationMinutes ?? null, timezone: item.data.timezone, link: item.data.link ?? null,
    } })
    return materialized(item, meeting.id, project?.id)
  }
  if (!project) throw new Error(`${item.entity} exige projeto.`)

  if (item.entity === 'TASK') {
    const module = item.data.moduleName
      ? await transaction.projectModule.upsert({
        where: { projectId_name: { projectId: project.id, name: item.data.moduleName } },
        create: { projectId: project.id, name: item.data.moduleName }, update: {},
      })
      : null
    const tags = item.data.tags?.length
      ? await Promise.all([...new Set(item.data.tags)].map((name) => transaction.projectTag.upsert({
        where: { projectId_name: { projectId: project.id, name } }, create: { projectId: project.id, name }, update: {},
      })))
      : []
    const milestones = item.data.milestones?.map((reference) => resolveEntityRef('MILESTONE', reference, localEntities, existingReferences)) ?? []
    milestones.forEach((milestone) => requireSameProject(project, milestone, 'Task/milestone'))
    const task = await transaction.task.create({ data: {
      project: { connect: { id: project.id } },
      title: item.data.title, description: item.data.description ?? '', kind: item.data.kind ?? 'TASK',
      status: item.data.status ?? 'BACKLOG', priority: item.data.priority ?? 'P3', complexity: item.data.complexity ?? null,
      dueAt: toDateOrNull(item.data.dueAt), forecastAt: toDateOrNull(item.data.forecastAt),
      ...(module ? { module: { connect: { id: module.id } } } : {}),
      ...(tags.length ? { tags: { create: tags.map((tag: any) => ({ tagId: tag.id })) } } : {}),
      ...(milestones.length ? { milestones: { create: milestones.map((milestone) => ({ milestoneId: milestone.id })) } } : {}),
    } })
    return materialized(item, task.id, project.id)
  }

  if (item.entity === 'NOTE') {
    const task = item.data.task ? resolveEntityRef('TASK', item.data.task, localEntities, existingReferences) : undefined
    if (task) requireSameProject(project, task, 'Nota/task')
    const note = await transaction.note.create({ data: {
      ownerId, projectId: project.id, taskId: task?.id ?? null, title: item.data.title, content: item.data.content,
    } })
    return materialized(item, note.id, project.id)
  }

  if (item.entity === 'MILESTONE') {
    const tasks = item.data.tasks?.map((reference) => resolveEntityRef('TASK', reference, localEntities, existingReferences)) ?? []
    tasks.forEach((task) => requireSameProject(project, task, 'Milestone/task'))
    const milestone = await transaction.milestone.create({ data: {
      project: { connect: { id: project.id } }, name: item.data.name, description: item.data.description ?? '',
      startAt: toDateOrNull(item.data.startAt), targetAt: new Date(item.data.targetAt), status: item.data.status ?? 'PLANNED',
      ...(tasks.length ? { tasks: { create: tasks.map((task) => ({ taskId: task.id })) } } : {}),
    } })
    return materialized(item, milestone.id, project.id)
  }

  if (item.entity === 'ALIAS') {
    const alias = await transaction.projectAlias.create({ data: { projectId: project.id, value: item.data.value } })
    return materialized(item, alias.id, project.id)
  }
  if (item.entity === 'MODULE') {
    const module = await transaction.projectModule.create({ data: { projectId: project.id, name: item.data.name } })
    return materialized(item, module.id, project.id)
  }
  if (item.entity === 'TAG') {
    const tag = await transaction.projectTag.create({ data: { projectId: project.id, name: item.data.name } })
    return materialized(item, tag.id, project.id)
  }
  const task = item.data.task ? resolveEntityRef('TASK', item.data.task, localEntities, existingReferences) : undefined
  if (task) requireSameProject(project, task, 'Contexto/task')
  const context = await transaction.projectContext.create({ data: {
    projectId: project.id, taskId: task?.id ?? null, category: item.data.category,
    title: item.data.title, content: item.data.content,
  } })
  return materialized(item, context.id, project.id)
}

type EntityRef = { existingId: string } | { localId: string }

function resolveEntityRef(
  type: RetrievalReferenceType,
  reference: EntityRef,
  localEntities: ReadonlyMap<string, MaterializedEntity>,
  existingReferences: ReadonlyMap<string, HarnessReferenceRecord>,
): { id: string; projectId?: string } {
  if ('existingId' in reference) {
    const existing = existingReferences.get(`${type}:${reference.existingId}`)
    if (!existing) throw new Error(`Referência ${reference.existingId} não foi revalidada.`)
    return { id: existing.id, projectId: existing.projectId }
  }
  const local = localEntities.get(reference.localId)
  if (!local || local.entityType !== type) throw new Error(`Referência local ${reference.localId} não aponta para ${type}.`)
  return { id: local.id, projectId: local.projectId }
}

function requireSameProject(left: { projectId?: string; id: string }, right: { projectId?: string; id: string }, label: string) {
  const leftProjectId = left.projectId ?? left.id
  const rightProjectId = right.projectId ?? right.id
  if (leftProjectId !== rightProjectId) throw new Error(`${label} exige mesmo projeto.`)
}

function materialized(
  item: HarnessProposalV1['items'][number],
  id: string,
  projectId?: string,
): MaterializedEntity {
  return { id, entityType: item.entity, proposalItemId: item.id, ...(projectId ? { projectId } : {}) }
}

function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null
}

function isRetryableTransactionConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error.code === 'P2034' || error.code === 'P2002'))
}
