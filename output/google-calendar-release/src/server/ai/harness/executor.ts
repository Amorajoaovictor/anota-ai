import { createHash } from 'node:crypto'
import { harnessProposalV1Schema, type HarnessProposalV1 } from './contracts'
import {
  collectExistingProposalReferences,
  orderSelectedProposalItems,
  type ExistingProposalReference,
} from './materialization'
import type { HarnessApproval } from './snapshots'
import type { HarnessRunStatus } from './state-machine'
import type { RetrievalReferenceType } from './retrieval'

export type HarnessExecutionContext = {
  ownerId: string
  run: { id: string; status: HarnessRunStatus; version: number }
  markdownRevision: { id: string; contentHash: string }
  proposalRevision: {
    id: string
    contentHash: string
    validatedPlan: unknown
    selectedItemIds: string[]
    proposalItemRecordIds?: Record<string, string>
  }
  approvals: HarnessApproval[]
}

export type HarnessReferenceRecord = {
  id: string
  ownerId: string
  entityType: RetrievalReferenceType
  projectId?: string
}

export type MaterializedEntity = {
  id: string
  entityType: HarnessProposalV1['items'][number]['entity']
  proposalItemId: string
  projectId?: string
}

export type HarnessExecutionRecord = {
  id: string
  aiRunId: string
  proposalRevisionId: string
  idempotencyKey: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  entityIds: string[]
}

export type HarnessExecutionStepJob = {
  executionId: string
  ownerId: string
  aiRunId: string
  proposalRevisionId: string
  targetHash: string
  expectedRunVersion: number
  orderedItemIds: string[]
  index: number
  localEntities: Record<string, MaterializedEntity>
}

export interface HarnessExecutionTransaction {
  findExecution(idempotencyKey: string): Promise<HarnessExecutionRecord | null>
  findOrigin(proposalItemId: string): Promise<MaterializedEntity | null>
  loadContext(ownerId: string, aiRunId: string, proposalRevisionId: string): Promise<HarnessExecutionContext | null>
  findReference(ownerId: string, reference: ExistingProposalReference): Promise<HarnessReferenceRecord | null>
  approveProposal(input: { aiRunId: string; ownerId: string; proposalRevisionId: string; targetHash: string }): Promise<HarnessApproval>
  beginRun(aiRunId: string, ownerId: string, expectedVersion: number): Promise<boolean>
  createExecution(input: Omit<HarnessExecutionRecord, 'id' | 'entityIds'>): Promise<HarnessExecutionRecord>
  createItem(
    ownerId: string,
    item: HarnessProposalV1['items'][number],
    localEntities: ReadonlyMap<string, MaterializedEntity>,
    existingReferences: ReadonlyMap<string, HarnessReferenceRecord>,
  ): Promise<MaterializedEntity>
  createOrigin(input: { proposalItemId: string; entityType: MaterializedEntity['entityType']; entityId: string }): Promise<void>
  createAudit(input: {
    actorId: string
    action: 'AI_ENTITY_CREATED'
    entityType: MaterializedEntity['entityType']
    entityId: string
    metadata: { aiRunId: string; proposalRevisionId: string; proposalItemId: string }
  }): Promise<void>
  completeExecution(executionId: string, entityIds: string[]): Promise<void>
  completeRun(aiRunId: string, ownerId: string, expectedVersion: number): Promise<boolean>
  enqueueExecutionStep(input: HarnessExecutionStepJob): Promise<void>
}

export interface HarnessExecutionRepository {
  transaction<T>(callback: (transaction: HarnessExecutionTransaction) => Promise<T>): Promise<T>
}

export type ExecuteHarnessProposalInput = {
  ownerId: string
  aiRunId: string
  proposalRevisionId: string
  targetHash?: string
  selectedItemIds?: string[]
  expectedRunVersion: number
}

export type ExecuteHarnessProposalResult = {
  kind: 'executed' | 'already-executed' | 'blocked' | 'not-found' | 'failed'
  executionId?: string
  entityIds?: string[]
  code?: 'APPROVAL_REQUIRED' | 'APPROVAL_MISMATCH' | 'STALE_VERSION' | 'INVALID_PROPOSAL' | 'INVALID_GRAPH' | 'REFERENCE_STALE' | 'EXECUTION_FAILED'
}

export type StartHarnessProposalResult = {
  kind: 'started' | 'already-running' | 'already-executed' | 'blocked' | 'not-found' | 'failed'
  executionId?: string
  entityIds?: string[]
  code?: ExecuteHarnessProposalResult['code']
}

export type ProcessHarnessExecutionResult = {
  kind: 'progress' | 'completed' | 'not-found' | 'blocked' | 'failed'
  executionId?: string
  entityIds?: string[]
  code?: ExecuteHarnessProposalResult['code']
}

/**
 * Inicia execucao sem materializar entidades. Cada item seguinte roda em job
 * proprio, mantendo transacoes curtas e retomaveis.
 */
export async function startApprovedHarnessProposal(
  repository: HarnessExecutionRepository,
  input: ExecuteHarnessProposalInput,
): Promise<StartHarnessProposalResult> {
  try {
    return await repository.transaction(async (transaction) => {
      const idempotencyKey = `execute:${input.proposalRevisionId}`
      const context = await transaction.loadContext(input.ownerId, input.aiRunId, input.proposalRevisionId)
      if (!context) return { kind: 'not-found' }
      const existing = await transaction.findExecution(idempotencyKey)
      if (existing?.status === 'COMPLETED') return { kind: 'already-executed', executionId: existing.id, entityIds: [...existing.entityIds] }
      if (existing) return { kind: 'already-running', executionId: existing.id, entityIds: [...existing.entityIds] }

      const prepared = await prepareApprovedProposal(transaction, context, input)
      if (prepared.kind !== 'ready') return prepared

      if (!await transaction.beginRun(input.aiRunId, input.ownerId, input.expectedRunVersion)) {
        throw new ExecutionBlocked('STALE_VERSION')
      }
      const execution = await transaction.createExecution({
        aiRunId: input.aiRunId,
        proposalRevisionId: input.proposalRevisionId,
        idempotencyKey,
        status: 'RUNNING',
      })
      if (prepared.ordered.length === 0) {
        await transaction.completeExecution(execution.id, [])
        if (!await transaction.completeRun(input.aiRunId, input.ownerId, input.expectedRunVersion)) {
          throw new ExecutionBlocked('STALE_VERSION')
        }
        return { kind: 'started', executionId: execution.id, entityIds: [] }
      }

      await transaction.enqueueExecutionStep({
        executionId: execution.id,
        ownerId: input.ownerId,
        aiRunId: input.aiRunId,
        proposalRevisionId: input.proposalRevisionId,
        targetHash: context.proposalRevision.contentHash,
        expectedRunVersion: input.expectedRunVersion,
        orderedItemIds: prepared.ordered.map((item) => item.id),
        index: 0,
        localEntities: {},
      })
      return { kind: 'started', executionId: execution.id, entityIds: [] }
    })
  } catch (error) {
    if (error instanceof ExecutionBlocked) return { kind: 'blocked', code: error.code }
    return { kind: 'failed', code: 'EXECUTION_FAILED' }
  }
}

/** Processa exatamente um item; proximo job nasce na mesma transacao. */
export async function processHarnessExecutionStep(
  repository: HarnessExecutionRepository,
  job: HarnessExecutionStepJob,
): Promise<ProcessHarnessExecutionResult> {
  try {
    return await repository.transaction(async (transaction) => {
      const context = await transaction.loadContext(job.ownerId, job.aiRunId, job.proposalRevisionId)
      if (!context) return { kind: 'not-found' }
      const execution = await transaction.findExecution(`execute:${job.proposalRevisionId}`)
      if (!execution) return { kind: 'not-found' }
      if (execution.status === 'COMPLETED' || context.run.status === 'PROCESSED') {
        return { kind: 'completed', executionId: execution.id, entityIds: [...execution.entityIds] }
      }
      if (context.run.status !== 'EXECUTING' || context.run.version !== job.expectedRunVersion) {
        throw new ExecutionBlocked('STALE_VERSION')
      }

      const parsed = harnessProposalV1Schema.safeParse(context.proposalRevision.validatedPlan)
      if (!parsed.success || hashJson(parsed.data) !== context.proposalRevision.contentHash || job.targetHash !== context.proposalRevision.contentHash) {
        throw new ExecutionBlocked('INVALID_PROPOSAL')
      }
      const itemId = job.orderedItemIds[job.index]
      const item = parsed.data.items.find((candidate) => candidate.id === itemId)
      if (!item) throw new ExecutionBlocked('INVALID_GRAPH')

      const localEntities = new Map<string, MaterializedEntity>(Object.entries(job.localEntities))
      const proposalItemId = context.proposalRevision.proposalItemRecordIds?.[item.id] ?? item.id
      const existingOrigin = await transaction.findOrigin(proposalItemId)
      if (existingOrigin) {
        localEntities.set(item.id, existingOrigin)
      } else {
        const existingReferences = new Map<string, HarnessReferenceRecord>()
        for (const reference of collectExistingProposalReferences({ ...parsed.data, items: [item] })) {
          const current = await transaction.findReference(job.ownerId, reference)
          if (!current) throw new ExecutionBlocked('REFERENCE_STALE')
          existingReferences.set(referenceKey(reference.expectedType, reference.id), current)
        }
        const entity = await transaction.createItem(job.ownerId, item, localEntities, existingReferences)
        localEntities.set(item.id, entity)
        await transaction.createOrigin({ proposalItemId, entityType: entity.entityType, entityId: entity.id })
        await transaction.createAudit({
          actorId: job.ownerId,
          action: 'AI_ENTITY_CREATED',
          entityType: entity.entityType,
          entityId: entity.id,
          metadata: { aiRunId: job.aiRunId, proposalRevisionId: job.proposalRevisionId, proposalItemId: item.id },
        })
      }

      const entityIds = [...localEntities.values()].map((entity) => entity.id)
      const nextIndex = job.index + 1
      if (nextIndex < job.orderedItemIds.length) {
        await transaction.enqueueExecutionStep({
          ...job,
          index: nextIndex,
          localEntities: Object.fromEntries(localEntities),
        })
        return { kind: 'progress', executionId: execution.id, entityIds }
      }

      await transaction.completeExecution(execution.id, entityIds)
      if (!await transaction.completeRun(job.aiRunId, job.ownerId, job.expectedRunVersion)) {
        throw new ExecutionBlocked('STALE_VERSION')
      }
      return { kind: 'completed', executionId: execution.id, entityIds }
    })
  } catch (error) {
    if (error instanceof ExecutionBlocked) return { kind: 'blocked', code: error.code }
    return { kind: 'failed', code: 'EXECUTION_FAILED' }
  }
}

async function prepareApprovedProposal(
  transaction: HarnessExecutionTransaction,
  context: HarnessExecutionContext,
  input: ExecuteHarnessProposalInput,
): Promise<
  | { kind: 'ready'; ordered: HarnessProposalV1['items'] }
  | { kind: 'blocked'; code: Exclude<ExecuteHarnessProposalResult['code'], 'EXECUTION_FAILED' | undefined> }
> {
  if (context.run.version !== input.expectedRunVersion) throw new ExecutionBlocked('STALE_VERSION')
  const parsed = harnessProposalV1Schema.safeParse(context.proposalRevision.validatedPlan)
  if (!parsed.success || hashJson(parsed.data) !== context.proposalRevision.contentHash) {
    throw new ExecutionBlocked('INVALID_PROPOSAL')
  }

  const selectedItemIds = input.selectedItemIds ?? context.proposalRevision.selectedItemIds
  if (input.selectedItemIds && !sameSelection(input.selectedItemIds, context.proposalRevision.selectedItemIds)) {
    throw new ExecutionBlocked('APPROVAL_MISMATCH')
  }
  if (context.run.status !== 'AWAITING_ENTITY_APPROVAL') throw new ExecutionBlocked('APPROVAL_REQUIRED')
  if (!hasExactApproval(context.approvals, 'MARKDOWN', context.markdownRevision)) {
    throw new ExecutionBlocked('APPROVAL_REQUIRED')
  }
  if (input.targetHash !== undefined && input.targetHash !== context.proposalRevision.contentHash) {
    throw new ExecutionBlocked('APPROVAL_MISMATCH')
  }

  const entityApproval = context.approvals.find((approval) => (
    approval.type === 'ENTITIES' && approval.targetId === context.proposalRevision.id
  ))
  if (entityApproval && entityApproval.targetHash !== context.proposalRevision.contentHash) {
    throw new ExecutionBlocked('APPROVAL_MISMATCH')
  }
  if (!entityApproval) {
    if (!input.targetHash) throw new ExecutionBlocked('APPROVAL_REQUIRED')
    await transaction.approveProposal({
      aiRunId: input.aiRunId,
      ownerId: input.ownerId,
      proposalRevisionId: context.proposalRevision.id,
      targetHash: context.proposalRevision.contentHash,
    })
  }

  let ordered: HarnessProposalV1['items']
  try {
    ordered = orderHarnessExecutionItems(parsed.data, selectedItemIds)
  } catch {
    throw new ExecutionBlocked('INVALID_GRAPH')
  }
  const selected = new Set(ordered.map((item) => item.id))
  const selectedProposal = { ...parsed.data, items: parsed.data.items.filter((item) => selected.has(item.id)) }
  for (const reference of collectExistingProposalReferences(selectedProposal)) {
    const current = await transaction.findReference(input.ownerId, reference)
    if (!current) throw new ExecutionBlocked('REFERENCE_STALE')
  }
  return { kind: 'ready', ordered }
}

/** Topologia preservada; entre itens prontos, fases garantem PROJECT -> TASK -> CONTEXT. */
export function orderHarnessExecutionItems(
  proposal: HarnessProposalV1,
  selectedItemIds: readonly string[],
): HarnessProposalV1['items'] {
  const selected = new Set(selectedItemIds)
  if (selected.size !== selectedItemIds.length) throw new Error('Selecao possui ID repetido.')
  const byId = new Map(proposal.items.map((item) => [item.id, item]))
  for (const id of selected) {
    if (!byId.has(id)) throw new Error(`Item selecionado inexistente: ${id}.`)
  }
  for (const item of proposal.items) {
    if (!selected.has(item.id)) continue
    if (item.dependsOn.some((dependencyId) => !selected.has(dependencyId))) {
      throw new Error(`Item ${item.id} depende de acao nao selecionada: ${item.dependsOn.join(', ')}.`)
    }
  }

  const ordered: HarnessProposalV1['items'] = []
  const remaining = new Set(selected)
  while (remaining.size) {
    const ready = proposal.items
      .filter((item) => remaining.has(item.id) && item.dependsOn.every((id) => !remaining.has(id)))
      .sort((left, right) => executionPhase(left.entity) - executionPhase(right.entity))
    if (!ready.length) throw new Error('Proposta contem ciclo entre dependencias selecionadas.')
    for (const item of ready) {
      ordered.push(item)
      remaining.delete(item.id)
    }
  }
  return ordered
}

function executionPhase(entity: HarnessProposalV1['items'][number]['entity']): number {
  if (entity === 'PROJECT') return 0
  if (entity === 'CONTEXT' || entity === 'NOTE') return 2
  if (entity === 'DEPENDENCY' || entity === 'TASK_MILESTONE') return 1
  return 1
}

export async function executeApprovedHarnessProposal(
  repository: HarnessExecutionRepository,
  input: ExecuteHarnessProposalInput,
): Promise<ExecuteHarnessProposalResult> {
  try {
    return await repository.transaction(async (transaction) => {
      const idempotencyKey = `execute:${input.proposalRevisionId}`
      const context = await transaction.loadContext(input.ownerId, input.aiRunId, input.proposalRevisionId)
      if (!context) return { kind: 'not-found' }
      const existing = await transaction.findExecution(idempotencyKey)
      if (existing) return { kind: 'already-executed', executionId: existing.id, entityIds: [...existing.entityIds] }
      if (context.run.version !== input.expectedRunVersion) throw new ExecutionBlocked('STALE_VERSION')

      const parsed = harnessProposalV1Schema.safeParse(context.proposalRevision.validatedPlan)
      if (!parsed.success || hashJson(parsed.data) !== context.proposalRevision.contentHash) {
        throw new ExecutionBlocked('INVALID_PROPOSAL')
      }
      if (
        input.selectedItemIds
        && !sameSelection(input.selectedItemIds, context.proposalRevision.selectedItemIds)
      ) throw new ExecutionBlocked('APPROVAL_MISMATCH')
      if (context.run.status !== 'AWAITING_ENTITY_APPROVAL') throw new ExecutionBlocked('APPROVAL_REQUIRED')
      const markdownApproved = hasExactApproval(context.approvals, 'MARKDOWN', context.markdownRevision)
      if (!markdownApproved) throw new ExecutionBlocked('APPROVAL_REQUIRED')
      if (input.targetHash !== undefined && input.targetHash !== context.proposalRevision.contentHash) {
        throw new ExecutionBlocked('APPROVAL_MISMATCH')
      }
      const entityApproval = context.approvals.find((approval) => (
        approval.type === 'ENTITIES' && approval.targetId === context.proposalRevision.id
      ))
      if (entityApproval && entityApproval.targetHash !== context.proposalRevision.contentHash) {
        throw new ExecutionBlocked('APPROVAL_MISMATCH')
      }
      if (!entityApproval) {
        if (!input.targetHash) throw new ExecutionBlocked('APPROVAL_REQUIRED')
        await transaction.approveProposal({
          aiRunId: input.aiRunId,
          ownerId: input.ownerId,
          proposalRevisionId: context.proposalRevision.id,
          targetHash: context.proposalRevision.contentHash,
        })
      }

      let ordered: HarnessProposalV1['items']
      try {
        ordered = orderSelectedProposalItems(parsed.data, context.proposalRevision.selectedItemIds)
      } catch {
        throw new ExecutionBlocked('INVALID_GRAPH')
      }

      const selected = new Set(ordered.map((item) => item.id))
      const selectedProposal = { ...parsed.data, items: parsed.data.items.filter((item) => selected.has(item.id)) }
      const existingReferences = new Map<string, HarnessReferenceRecord>()
      for (const reference of collectExistingProposalReferences(selectedProposal)) {
        const current = await transaction.findReference(input.ownerId, reference)
        if (!current) throw new ExecutionBlocked('REFERENCE_STALE')
        existingReferences.set(referenceKey(reference.expectedType, reference.id), current)
      }
      if (!await transaction.beginRun(input.aiRunId, input.ownerId, input.expectedRunVersion)) {
        throw new ExecutionBlocked('STALE_VERSION')
      }

      const execution = await transaction.createExecution({
        aiRunId: input.aiRunId,
        proposalRevisionId: input.proposalRevisionId,
        idempotencyKey,
        status: 'RUNNING',
      })
      const localEntities = new Map<string, MaterializedEntity>()
      for (const item of ordered) {
        const entity = await transaction.createItem(input.ownerId, item, localEntities, existingReferences)
        localEntities.set(item.id, entity)
        await transaction.createOrigin({
          proposalItemId: context.proposalRevision.proposalItemRecordIds?.[item.id] ?? item.id,
          entityType: entity.entityType,
          entityId: entity.id,
        })
        await transaction.createAudit({
          actorId: input.ownerId,
          action: 'AI_ENTITY_CREATED',
          entityType: entity.entityType,
          entityId: entity.id,
          metadata: { aiRunId: input.aiRunId, proposalRevisionId: input.proposalRevisionId, proposalItemId: item.id },
        })
      }
      const entityIds = [...localEntities.values()].map((entity) => entity.id)
      await transaction.completeExecution(execution.id, entityIds)
      if (!await transaction.completeRun(input.aiRunId, input.ownerId, input.expectedRunVersion)) {
        throw new ExecutionBlocked('STALE_VERSION')
      }
      return { kind: 'executed', executionId: execution.id, entityIds }
    })
  } catch (error) {
    if (error instanceof ExecutionBlocked) return { kind: 'blocked', code: error.code }
    return { kind: 'failed', code: 'EXECUTION_FAILED' }
  }
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')
}

class ExecutionBlocked extends Error {
  constructor(readonly code: Exclude<ExecuteHarnessProposalResult['code'], 'EXECUTION_FAILED' | undefined>) {
    super(code)
  }
}

function referenceKey(type: RetrievalReferenceType, id: string) {
  return `${type}:${id}`
}

function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length || new Set(left).size !== left.length || new Set(right).size !== right.length) return false
  const expected = new Set(right)
  return left.every((id) => expected.has(id))
}

function hasExactApproval(
  approvals: readonly HarnessApproval[],
  type: HarnessApproval['type'],
  target: { id: string; contentHash: string },
): boolean {
  return approvals.some((approval) => (
    approval.type === type && approval.targetId === target.id && approval.targetHash === target.contentHash
  ))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

type FakeState = {
  executions: HarnessExecutionRecord[]
  entities: MaterializedEntity[]
  origins: Array<{ proposalItemId: string; entityType: MaterializedEntity['entityType']; entityId: string }>
  audits: Array<{
    actorId: string
    action: string
    entityType: MaterializedEntity['entityType']
    entityId: string
    metadata: { aiRunId: string; proposalRevisionId: string; proposalItemId: string }
  }>
  runStatuses: Record<string, HarnessRunStatus>
  references: HarnessReferenceRecord[]
  approvals: Record<string, HarnessApproval[]>
  queuedSteps: HarnessExecutionStepJob[]
  sequence: number
}

export type InMemoryHarnessExecutionOptions = {
  references?: HarnessReferenceRecord[]
  failOnItemId?: string
  failOnAuditItemId?: string
}

/** Fake transacional determinístico. Callback confirma clone inteiro ou descarta tudo. */
export class InMemoryHarnessExecutionRepository implements HarnessExecutionRepository {
  private state: FakeState
  private gate: Promise<void> = Promise.resolve()

  constructor(
    private readonly contexts: readonly HarnessExecutionContext[],
    private readonly options: InMemoryHarnessExecutionOptions = {},
  ) {
    this.state = {
      executions: [], entities: [], origins: [], audits: [],
      runStatuses: Object.fromEntries(contexts.map((context) => [context.run.id, context.run.status])),
      approvals: Object.fromEntries(contexts.map((context) => [context.run.id, structuredClone(context.approvals)])),
      references: structuredClone(options.references ?? []), queuedSteps: [], sequence: 0,
    }
  }

  async transaction<T>(callback: (transaction: HarnessExecutionTransaction) => Promise<T>): Promise<T> {
    let release: () => void = () => undefined
    const prior = this.gate
    this.gate = new Promise<void>((resolve) => { release = resolve })
    await prior
    const draft = structuredClone(this.state)
    try {
      const result = await callback(this.createTransaction(draft))
      this.state = draft
      return result
    } finally {
      release()
    }
  }

  snapshot() {
    return structuredClone({
      executions: this.state.executions,
      entities: this.state.entities,
      origins: this.state.origins,
      audits: this.state.audits,
      approvals: Object.values(this.state.approvals).flat(),
      queuedSteps: this.state.queuedSteps,
    })
  }

  getRunStatus(aiRunId: string): HarnessRunStatus | undefined {
    return this.state.runStatuses[aiRunId]
  }

  removeReference(id: string): void {
    this.state.references = this.state.references.filter((reference) => reference.id !== id)
  }

  private createTransaction(draft: FakeState): HarnessExecutionTransaction {
    return {
      findExecution: async (idempotencyKey) => draft.executions.find((execution) => execution.idempotencyKey === idempotencyKey) ?? null,
      findOrigin: async (proposalItemId) => {
        const origin = draft.origins.find((candidate) => candidate.proposalItemId === proposalItemId)
        if (!origin) return null
        return draft.entities.find((entity) => entity.proposalItemId === proposalItemId) ?? {
          id: origin.entityId,
          entityType: origin.entityType,
          proposalItemId,
        }
      },
      loadContext: async (ownerId, aiRunId, proposalRevisionId) => {
        const stored = this.contexts.find((context) => (
          context.ownerId === ownerId
          && context.run.id === aiRunId
          && context.proposalRevision.id === proposalRevisionId
        ))
        if (!stored) return null
        return structuredClone({
          ...stored,
          run: { ...stored.run, status: draft.runStatuses[aiRunId] ?? stored.run.status },
          approvals: draft.approvals[aiRunId] ?? [],
        })
      },
      findReference: async (ownerId, reference) => draft.references.find((candidate) => (
        candidate.ownerId === ownerId
        && candidate.id === reference.id
        && candidate.entityType === reference.expectedType
      )) ?? null,
      approveProposal: async (input) => {
        const approvals = draft.approvals[input.aiRunId] ?? (draft.approvals[input.aiRunId] = [])
        const existing = approvals.find((approval) => approval.type === 'ENTITIES' && approval.targetId === input.proposalRevisionId)
        if (existing) return structuredClone(existing)
        const approval: HarnessApproval = { type: 'ENTITIES', targetId: input.proposalRevisionId, targetHash: input.targetHash }
        approvals.push(approval)
        return structuredClone(approval)
      },
      beginRun: async (aiRunId, ownerId, expectedVersion) => {
        const context = this.contexts.find((candidate) => candidate.run.id === aiRunId && candidate.ownerId === ownerId)
        if (!context || context.run.version !== expectedVersion || draft.runStatuses[aiRunId] !== 'AWAITING_ENTITY_APPROVAL') return false
        draft.runStatuses[aiRunId] = 'EXECUTING'
        return true
      },
      createExecution: async (input) => {
        if (draft.executions.some((execution) => execution.idempotencyKey === input.idempotencyKey)) {
          throw new Error('IDEMPOTENCY_CONFLICT')
        }
        const execution = { ...input, id: `execution-${++draft.sequence}`, entityIds: [] }
        draft.executions.push(execution)
        return structuredClone(execution)
      },
      createItem: async (ownerId, item, localEntities, existingReferences) => {
        if (this.options.failOnItemId === item.id) throw new Error('Falha simulada ao criar item.')
        const id = `${item.entity.toLocaleLowerCase()}-${++draft.sequence}`
        const project = 'project' in item.data ? item.data.project : undefined
        let projectId: string | undefined
        if (project && 'localId' in project) projectId = localEntities.get(project.localId)?.projectId
        if (project && 'existingId' in project) projectId = existingReferences.get(referenceKey('PROJECT', project.existingId))?.id
        if (item.entity === 'PROJECT') projectId = id
        const entity = { id, entityType: item.entity, proposalItemId: item.id, ...(projectId ? { projectId } : {}) }
        draft.entities.push(entity)
        return structuredClone(entity)
      },
      createOrigin: async (origin) => {
        if (draft.origins.some((existing) => existing.entityType === origin.entityType && existing.entityId === origin.entityId)) {
          throw new Error('Origem duplicada.')
        }
        draft.origins.push(structuredClone(origin))
      },
      createAudit: async (audit) => {
        if (this.options.failOnAuditItemId === audit.metadata.proposalItemId) throw new Error('Falha simulada na auditoria.')
        draft.audits.push(structuredClone(audit))
      },
      completeExecution: async (executionId, entityIds) => {
        const execution = draft.executions.find((candidate) => candidate.id === executionId)
        if (!execution) throw new Error('Execução não encontrada.')
        execution.status = 'COMPLETED'
        execution.entityIds = [...entityIds]
      },
      completeRun: async (aiRunId, ownerId, expectedVersion) => {
        const context = this.contexts.find((candidate) => candidate.run.id === aiRunId && candidate.ownerId === ownerId)
        if (!context || context.run.version !== expectedVersion || draft.runStatuses[aiRunId] !== 'EXECUTING') return false
        draft.runStatuses[aiRunId] = 'PROCESSED'
        return true
      },
      enqueueExecutionStep: async (input) => {
        const exists = draft.queuedSteps.some((step) => step.executionId === input.executionId && step.index === input.index)
        if (!exists) draft.queuedSteps.push(structuredClone(input))
      },
    }
  }
}
