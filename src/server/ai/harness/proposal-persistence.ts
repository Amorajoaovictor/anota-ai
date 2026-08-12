import { randomUUID } from 'node:crypto'
import { harnessProposalV1Schema, type HarnessProposalV1 } from './contracts'
import { hashJson } from './executor'
import { orderSelectedProposalItems } from './materialization'

type ProposalRepository = {
  aiRun: {
    findFirst(args: any): Promise<any>
    updateMany(args: any): Promise<{ count: number }>
  }
  proposalRevision: {
    findFirst(args: any): Promise<any>
    create(args: any): Promise<any>
  }
  proposalItem: { create(args: any): Promise<any> }
  $transaction<T>(callback: (transaction: ProposalRepository) => Promise<T>): Promise<T>
}

export type AppendUserProposalInput = {
  expectedVersion: number
  proposal: unknown
  selectedItemIds: string[]
}

export type AppendUserProposalResult =
  | { kind: 'created'; revision: any }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }
  | { kind: 'stale-version' }
  | { kind: 'invalid-state' }

export async function appendUserProposalRevision(
  repository: ProposalRepository,
  ownerId: string,
  aiRunId: string,
  input: AppendUserProposalInput,
): Promise<AppendUserProposalResult> {
  const parsed = harnessProposalV1Schema.safeParse(input.proposal)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }
  try {
    orderSelectedProposalItems(parsed.data, input.selectedItemIds)
  } catch (error) {
    return { kind: 'invalid', issues: [error instanceof Error ? error.message : 'Selecao invalida.'] }
  }

  return repository.$transaction(async (transaction) => {
    const run = await transaction.aiRun.findFirst({
      where: { id: aiRunId, ownerId },
      select: { id: true, ownerId: true, status: true, version: true, activeProposalRevisionId: true },
    })
    if (!run) return { kind: 'not-found' }
    if (run.version !== input.expectedVersion) return { kind: 'stale-version' }
    if (run.status !== 'AWAITING_ENTITY_APPROVAL' || !run.activeProposalRevisionId) return { kind: 'invalid-state' }

    const parent = await transaction.proposalRevision.findFirst({
      where: { id: run.activeProposalRevisionId, aiRunId },
      select: {
        id: true, version: true, markdownRevisionId: true, retrievalSnapshotId: true,
      },
    })
    if (!parent) return { kind: 'not-found' }

    const revisionId = randomUUID()
    const updated = await transaction.aiRun.updateMany({
      where: {
        id: aiRunId,
        ownerId,
        status: 'AWAITING_ENTITY_APPROVAL',
        version: input.expectedVersion,
      },
      data: { activeProposalRevisionId: revisionId, version: { increment: 1 } },
    })
    if (updated.count !== 1) return { kind: 'stale-version' }

    const revision = await createProposalRevisionRecord(transaction, {
      id: revisionId,
      aiRunId,
      markdownRevisionId: parent.markdownRevisionId,
      retrievalSnapshotId: parent.retrievalSnapshotId,
      version: parent.version + 1,
      parentRevisionId: parent.id,
      source: 'USER',
      proposal: parsed.data,
      selectedItemIds: input.selectedItemIds,
    })
    return { kind: 'created', revision }
  })
}

export async function createProposalRevisionRecord(
  repository: Pick<ProposalRepository, 'proposalRevision' | 'proposalItem'>,
  input: {
    id?: string
    aiRunId: string
    markdownRevisionId: string
    retrievalSnapshotId: string
    version: number
    parentRevisionId?: string | null
    source: 'AI' | 'USER'
    proposal: HarnessProposalV1
    selectedItemIds: readonly string[]
    rawOutput?: unknown
    promptVersion?: string
    provider?: string
    model?: string
    inputTokens?: number
    outputTokens?: number
    latencyMs?: number
  },
): Promise<any> {
  const id = input.id ?? randomUUID()
  const selected = new Set(input.selectedItemIds)
  const revision = await repository.proposalRevision.create({
    data: {
      id,
      aiRunId: input.aiRunId,
      markdownRevisionId: input.markdownRevisionId,
      retrievalSnapshotId: input.retrievalSnapshotId,
      version: input.version,
      parentRevisionId: input.parentRevisionId ?? null,
      source: input.source,
      schemaVersion: input.proposal.schemaVersion,
      rawOutput: input.rawOutput,
      validatedPlan: input.proposal,
      contentHash: hashJson(input.proposal),
      promptVersion: input.promptVersion,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      latencyMs: input.latencyMs,
    },
  })
  for (const item of input.proposal.items) {
    await repository.proposalItem.create({
      data: {
        proposalRevisionId: id,
        localKey: item.id,
        entityType: item.entity,
        operation: item.operation,
        payload: item.data,
        dependsOn: item.dependsOn,
        evidence: item.evidence,
        confidence: item.confidence,
        duplicateCandidates: item.duplicateCandidates,
        selected: selected.has(item.id),
        userEdited: input.source === 'USER',
      },
    })
  }
  return revision
}
