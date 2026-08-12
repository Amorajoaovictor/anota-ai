import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { enqueue, type JobRecord } from '../../jobs/queue'
import { commitHarnessJobResult } from './orchestration'
import { HARNESS_PROPOSAL_SCHEMA_VERSION } from './contracts'
import { materializeApprovedProposal, type MaterializationProvider } from './materialization'
import { createProposalRevisionRecord } from './proposal-persistence'
import { createReferenceOnlySnapshot, type ReferenceOnlySnapshot, type RetrievalProvider } from './retrieval'
import { buildMaterializationInput } from './snapshots'
import { deriveMarkdownTopics, topicInputsFromMarkdown, type MarkdownTopicMetadata } from './topics'
import type { HarnessTokenBudget } from './config'

const retrievePayloadSchema = z.object({ markdownRevisionId: z.string().trim().min(1) }).strict()
const materializePayloadSchema = z.object({ retrievalSnapshotId: z.string().trim().min(1) }).strict()

type HarnessPipelineRepository = any

export async function processRetrievalJob(
  repository: HarnessPipelineRepository,
  job: JobRecord,
  provider: RetrievalProvider,
  options: { materializationTimeoutMs?: number } = {},
) {
  const payload = retrievePayloadSchema.parse(job.payload)
  if (!await isCurrent(repository, job, 'RETRIEVING_REFERENCES')) return { kind: 'stale' } as const
  const markdown = await repository.markdownRevision.findFirst({
    where: { id: payload.markdownRevisionId, aiRunId: job.aiRunId },
  })
  if (!markdown || markdown.contentHash !== job.inputHash) return { kind: 'stale' } as const
  const approval = await repository.aiApproval.findFirst({
    where: { aiRunId: job.aiRunId, type: 'MARKDOWN', targetId: markdown.id, targetHash: markdown.contentHash },
  })
  if (!approval) throw new Error('Markdown exato nao possui aprovacao.')

  const metadata = readTopics(markdown.content, markdown.topics)
  const retrieved = await provider.retrieve({
    ownerId: job.ownerId!,
    topics: topicInputsFromMarkdown(markdown.content, metadata),
    limits: { perTopic: 20, perType: 5 },
  })
  const snapshot = createReferenceOnlySnapshot(job.aiRunId!, markdown.id, retrieved.references)

  return commitHarnessJobResult(repository, job, {
    expectedStatus: 'RETRIEVING_REFERENCES',
    nextStatus: 'MATERIALIZING',
    write: async (transaction: any) => {
      await transaction.retrievalSnapshot.create({
        data: {
          id: snapshot.id,
          aiRunId: snapshot.aiRunId,
          markdownRevisionId: snapshot.markdownRevisionId,
          queryVersion: 'retrieval-v1',
          contentHash: snapshot.contentHash,
          candidates: snapshot.references,
        },
      })
      await enqueue(transaction, {
        type: 'ai.materialize',
        payload: { retrievalSnapshotId: snapshot.id },
        ownerId: job.ownerId!,
        aiRunId: job.aiRunId!,
        step: 'MATERIALIZING',
        inputVersion: job.inputVersion! + 1,
        inputHash: snapshot.contentHash,
        priority: job.priority,
        timeoutMs: options.materializationTimeoutMs ?? 90_000,
        dedupeKey: `materialize:${job.aiRunId}:${markdown.contentHash}:${snapshot.contentHash}:materializer-v1:configured`,
      })
      return snapshot
    },
  })
}

export async function processMaterializationJob(
  repository: HarnessPipelineRepository,
  job: JobRecord,
  provider: MaterializationProvider,
  options: {
    now: string
    timezone: string
    promptVersion: string
    signal?: AbortSignal
    budget?: HarnessTokenBudget
    providerName?: string
    model?: string
  },
) {
  const payload = materializePayloadSchema.parse(job.payload)
  if (!await isCurrent(repository, job, 'MATERIALIZING')) return { kind: 'stale' } as const
  const storedSnapshot = await repository.retrievalSnapshot.findFirst({
    where: { id: payload.retrievalSnapshotId, aiRunId: job.aiRunId },
  })
  if (!storedSnapshot || storedSnapshot.contentHash !== job.inputHash) return { kind: 'stale' } as const
  const markdown = await repository.markdownRevision.findFirst({
    where: { id: storedSnapshot.markdownRevisionId, aiRunId: job.aiRunId },
  })
  if (!markdown) throw new Error('Markdown aprovado nao encontrado para materializacao.')
  const approval = await repository.aiApproval.findFirst({
    where: { aiRunId: job.aiRunId, type: 'MARKDOWN', targetId: markdown.id, targetHash: markdown.contentHash },
  })
  if (!approval) throw new Error('Markdown exato nao possui aprovacao.')
  const callAttempt = await nextCallAttempt(repository, job.aiRunId!, 'MATERIALIZING')

  const snapshot: ReferenceOnlySnapshot = {
    marker: 'REFERENCE_ONLY',
    id: storedSnapshot.id,
    aiRunId: storedSnapshot.aiRunId,
    markdownRevisionId: storedSnapshot.markdownRevisionId,
    contentHash: storedSnapshot.contentHash,
    references: storedSnapshot.candidates,
  }
  let generated: Awaited<ReturnType<typeof materializeApprovedProposal>>
  try {
    if (options.budget) {
      const referenceTokens = Array.from(JSON.stringify(snapshot.references)).length
      if (referenceTokens > options.budget.reservedReferenceTokens) {
        throw new Error('REFERENCE_BUDGET_EXCEEDED')
      }
    }
    const materializationInput = buildMaterializationInput({
      approvedMarkdownRevision: markdown,
      markdownApproval: approval,
      retrievalSnapshot: {
        id: snapshot.id,
        contentHash: snapshot.contentHash,
        references: snapshot.references,
      },
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      now: options.now,
      timezone: options.timezone,
    })
    const topics = readTopics(markdown.content, markdown.topics)
    const topicInputs = topicInputsFromMarkdown(markdown.content, topics)
    generated = await materializeApprovedProposal(provider, {
      approvedMarkdown: materializationInput.approvedMarkdown,
      approvedMarkdownHash: materializationInput.approvedMarkdownHash,
      retrievalSnapshot: snapshot,
      now: options.now,
      timezone: options.timezone,
      topics: topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        text: topicInputs.find((input) => input.id === topic.id)?.text,
      })),
    }, options.signal)
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Job cancelado.')
  } catch (error) {
    const errorCode = sanitizePipelineErrorCode(error)
    await repository.aiCallAttempt.create({
      data: {
        aiRunId: job.aiRunId,
        step: 'MATERIALIZING',
        attempt: callAttempt,
        provider: options.providerName ?? 'configured',
        model: options.model ?? 'configured',
        promptVersion: options.promptVersion,
        inputHash: job.inputHash,
        technicalResult: errorCode === 'REFERENCE_BUDGET_EXCEEDED' ? 'INPUT_TOO_LARGE' : 'ERROR',
        errorCode,
      },
    })
    throw error
  }
  const proposalRevisionId = randomUUID()

  return commitHarnessJobResult(repository, job, {
    expectedStatus: 'MATERIALIZING',
    nextStatus: 'AWAITING_ENTITY_APPROVAL',
    runData: { activeProposalRevisionId: proposalRevisionId },
    write: async (transaction: any) => {
      const previous = typeof transaction.proposalRevision.findFirst === 'function'
        ? await transaction.proposalRevision.findFirst({ where: { aiRunId: job.aiRunId }, orderBy: { version: 'desc' } })
        : null
      const revision = await createProposalRevisionRecord(transaction, {
        id: proposalRevisionId,
        aiRunId: job.aiRunId!,
        markdownRevisionId: markdown.id,
        retrievalSnapshotId: snapshot.id,
        version: (previous?.version ?? 0) + 1,
        parentRevisionId: previous?.id ?? null,
        source: 'AI',
        proposal: generated.proposal,
        selectedItemIds: generated.proposal.items.map((item) => item.id),
        promptVersion: options.promptVersion,
        provider: generated.attempt.provider,
        model: generated.attempt.model,
        inputTokens: generated.attempt.inputTokens,
        outputTokens: generated.attempt.outputTokens,
        latencyMs: generated.attempt.latencyMs,
      })
      await transaction.aiCallAttempt.create({
        data: {
          aiRunId: job.aiRunId,
          step: 'MATERIALIZING',
          attempt: callAttempt,
          provider: generated.attempt.provider,
          model: generated.attempt.model,
          promptVersion: options.promptVersion,
          inputHash: job.inputHash,
          inputTokens: generated.attempt.inputTokens,
          outputTokens: generated.attempt.outputTokens,
          latencyMs: generated.attempt.latencyMs,
          technicalResult: generated.usedUnresolvedFallback ? 'FALLBACK_UNRESOLVED' : 'SUCCESS',
          errorCode: generated.usedUnresolvedFallback ? 'MATERIALIZATION_SCHEMA_INVALID' : null,
        },
      })
      return revision
    },
  })
}

async function nextCallAttempt(repository: HarnessPipelineRepository, aiRunId: string, step: 'MATERIALIZING') {
  const latest = await repository.aiCallAttempt.findFirst({
    where: { aiRunId, step },
    orderBy: { attempt: 'desc' },
    select: { attempt: true },
  })
  return (latest?.attempt ?? 0) + 1
}

async function isCurrent(repository: HarnessPipelineRepository, job: JobRecord, status: string): Promise<boolean> {
  if (!job.aiRunId || !job.ownerId || job.inputVersion === null || !job.inputHash || job.cancelledAt) return false
  const run = await repository.aiRun.findFirst({
    where: {
      id: job.aiRunId,
      ownerId: job.ownerId,
      status,
      version: job.inputVersion,
      discardedAt: null,
    },
    select: { id: true },
  })
  return Boolean(run)
}

function readTopics(content: string, raw: unknown): MarkdownTopicMetadata[] {
  if (Array.isArray(raw) && raw.every((topic) => (
    topic && typeof topic === 'object'
    && typeof topic.id === 'string'
    && typeof topic.title === 'string'
    && Number.isInteger(topic.order)
  ))) return raw as MarkdownTopicMetadata[]
  return deriveMarkdownTopics(content)
}

function sanitizePipelineErrorCode(error: unknown): string {
  if (error instanceof Error && error.message === 'REFERENCE_BUDGET_EXCEEDED') return 'REFERENCE_BUDGET_EXCEEDED'
  const name = error instanceof Error ? error.name.toUpperCase().replace(/[^A-Z0-9_]/gu, '_') : ''
  return name && name.length <= 80 ? name : 'MATERIALIZATION_ERROR'
}
