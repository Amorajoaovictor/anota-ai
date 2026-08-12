import { randomUUID } from 'node:crypto'
import { canonicalizeMarkdown, hashMarkdown } from './hash'
import { deriveMarkdownTopics, type MarkdownTopicMetadata } from './topics'

type InboxOwnerRepository = {
  inboxItem: {
    findFirst(args: unknown): Promise<{ id: string } | null>
  }
}

type AiRunRecord = {
  id: string
  ownerId: string
  inboxItemId: string
  status: string
  version: number
}

type AiRunRepository = {
  aiRun: {
    create(args: unknown): Promise<AiRunRecord>
    findFirst(args: unknown): Promise<AiRunRecord | null>
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

type MarkdownRevisionRecord = {
  id: string
  aiRunId: string
  version: number
  parentRevisionId: string | null
  source: 'AI' | 'USER'
  content: string
  contentHash: string
  tokenCount: number
  topics?: MarkdownTopicMetadata[]
}

type MarkdownRepository = {
  markdownRevision: {
    findFirst(args: unknown): Promise<MarkdownRevisionRecord | null>
    create(args: unknown): Promise<MarkdownRevisionRecord>
  }
}

type DerivedJobRepository = {
  job: {
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

type TransactionRepository = {
  $transaction<T>(callback: (transaction: HarnessRevisionRepository) => Promise<T>): Promise<T>
}

type HarnessRevisionRepository = AiRunRepository & MarkdownRepository & DerivedJobRepository
type HarnessRunRepository = InboxOwnerRepository & AiRunRepository

type ExecutionRecord = {
  id: string
  aiRunId: string
  proposalRevisionId: string
  idempotencyKey: string
  status: string
}

type ExecutionRepository = {
  aiExecution: {
    findUnique(args: unknown): Promise<ExecutionRecord | null>
    create(args: unknown): Promise<ExecutionRecord>
  }
}

export type CreateHarnessRunResult =
  | { kind: 'created'; run: AiRunRecord }
  | { kind: 'not-found' }

export async function createHarnessRun(
  repository: HarnessRunRepository,
  ownerId: string,
  inboxItemId: string,
): Promise<CreateHarnessRunResult> {
  const inboxItem = await repository.inboxItem.findFirst({
    where: { id: inboxItemId, ownerId },
    select: { id: true },
  })
  if (!inboxItem) return { kind: 'not-found' }

  const run = await repository.aiRun.create({
    data: {
      ownerId,
      inboxItemId: inboxItem.id,
      status: 'RECEIVED',
      version: 0,
      retryable: false,
    },
  })
  return { kind: 'created', run }
}

export type AppendMarkdownRevisionInput = {
  expectedVersion: number
  source: 'AI' | 'USER'
  content: string
  tokenCount: number
  topics?: MarkdownTopicMetadata[]
  promptVersion?: string
  model?: string
}

export type AppendMarkdownRevisionResult =
  | { kind: 'created'; revision: MarkdownRevisionRecord }
  | { kind: 'not-found' }
  | { kind: 'stale-version' }
  | { kind: 'invalid-state' }

export async function appendMarkdownRevision(
  repository: HarnessRevisionRepository & TransactionRepository,
  ownerId: string,
  aiRunId: string,
  input: AppendMarkdownRevisionInput,
): Promise<AppendMarkdownRevisionResult> {
  return repository.$transaction(async (transaction) => {
    const run = await transaction.aiRun.findFirst({
      where: { id: aiRunId, ownerId },
      select: { id: true, ownerId: true, inboxItemId: true, status: true, version: true },
    })
    if (!run) return { kind: 'not-found' }
    if (run.version !== input.expectedVersion) return { kind: 'stale-version' }
    if (input.source === 'USER' && ['EXECUTING', 'PROCESSED', 'DISCARDED'].includes(run.status)) {
      return { kind: 'invalid-state' }
    }

    const previous = await transaction.markdownRevision.findFirst({
      where: { aiRunId },
      orderBy: { version: 'desc' },
    })
    const revisionId = randomUUID()
    const invalidatesDerivedArtifacts = input.source === 'USER' && [
      'RETRIEVING_REFERENCES',
      'MATERIALIZING',
      'AWAITING_ENTITY_APPROVAL',
      'FAILED',
    ].includes(run.status)
    const updated = await transaction.aiRun.updateMany({
      where: { id: aiRunId, ownerId, status: run.status, version: input.expectedVersion },
      data: {
        version: { increment: 1 },
        activeMarkdownRevisionId: revisionId,
        ...(invalidatesDerivedArtifacts ? {
          status: 'AWAITING_MARKDOWN_APPROVAL',
          activeProposalRevisionId: null,
          failedStep: null,
          errorCode: null,
          retryable: false,
        } : {}),
      },
    })
    if (updated.count === 0) return { kind: 'stale-version' }
    if (invalidatesDerivedArtifacts) {
      await transaction.job.updateMany({
        where: {
          aiRunId,
          status: { in: ['PENDING', 'RUNNING'] },
          step: { in: ['RETRIEVING_REFERENCES', 'MATERIALIZING'] },
          cancelledAt: null,
        },
        data: { cancelledAt: new Date() },
      })
    }

    const content = canonicalizeMarkdown(input.content)
    const topics = input.topics ?? deriveMarkdownTopics(content, previous?.topics ?? [])
    const revision = await transaction.markdownRevision.create({
      data: {
        id: revisionId,
        aiRunId,
        version: (previous?.version ?? 0) + 1,
        parentRevisionId: previous?.id ?? null,
        source: input.source,
        content,
        contentHash: hashMarkdown(content),
        tokenCount: input.tokenCount,
        topics,
        promptVersion: input.promptVersion,
        model: input.model,
      },
    })
    return { kind: 'created', revision }
  })
}

export async function getOrCreateExecution(
  repository: ExecutionRepository,
  aiRunId: string,
  proposalRevisionId: string,
): Promise<ExecutionRecord> {
  const idempotencyKey = `execute:${proposalRevisionId}`
  const existing = await repository.aiExecution.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  try {
    return await repository.aiExecution.create({
      data: { aiRunId, proposalRevisionId, idempotencyKey, status: 'PENDING' },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const winner = await repository.aiExecution.findUnique({ where: { idempotencyKey } })
    if (!winner) throw error
    return winner
  }
}

function isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
}
