import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { JobHandlerContext } from '../../jobs/handlers'
import type { JobRecord } from '../../jobs/queue'
import { commitHarnessJobResult } from './orchestration'
import { organizeTranscript, type HarnessOrganizerProvider, type OrganizerLimits } from './organizer'
import { noopTechnicalMetrics, type TechnicalMetrics } from './metrics'
import { deriveMarkdownTopics } from './topics'

const payloadSchema = z.object({ transcriptRevisionId: z.string().trim().min(1) }).strict()

type OrganizationRepository = {
  aiRun: {
    findFirst(args: any): Promise<{ id: string; ownerId: string; status: string; version: number; discardedAt: Date | null } | null>
    updateMany(args: any): Promise<{ count: number }>
  }
  transcriptRevision: {
    findFirst(args: any): Promise<{ id: string; aiRunId: string; text: string; contentHash: string } | null>
  }
  markdownRevision: {
    findFirst(args: any): Promise<{ version: number } | null>
    create(args: any): Promise<any>
  }
  aiCallAttempt: { create(args: any): Promise<any> }
  $transaction<T>(callback: (transaction: OrganizationRepository) => Promise<T>): Promise<T>
}

export type OrganizationJobDependencies = {
  repository: OrganizationRepository
  provider: HarnessOrganizerProvider
  limits: OrganizerLimits
  promptVersion: string
  timezone: string
  providerName: string
  model: string
  metrics?: TechnicalMetrics
  now?: () => Date
}

export async function processHarnessOrganization(
  dependencies: OrganizationJobDependencies,
  job: JobRecord,
  context: JobHandlerContext,
): Promise<{ kind: 'organized'; revision: any } | { kind: 'stale' }> {
  const payload = payloadSchema.parse(job.payload)
  const metrics = dependencies.metrics ?? noopTechnicalMetrics
  const now = dependencies.now ?? (() => new Date())
  const startedAt = now().getTime()

  if (!await beginOrganization(dependencies.repository, job) || await context.isCancelled()) {
    metrics.increment('harness.job.stale_result', tags(job, dependencies))
    return { kind: 'stale' }
  }

  try {
    const transcript = await dependencies.repository.transcriptRevision.findFirst({
      where: { id: payload.transcriptRevisionId, aiRunId: job.aiRunId },
      select: { id: true, aiRunId: true, text: true, contentHash: true },
    })
    if (!transcript || transcript.contentHash !== job.inputHash) throw new OrganizationSnapshotMismatchError()

    const organized = await organizeTranscript({
      transcript: transcript.text,
      currentDate: dateInTimezone(now(), dependencies.timezone),
      timezone: dependencies.timezone,
      promptVersion: dependencies.promptVersion,
    }, dependencies.limits, dependencies.provider, context.signal)
    if (context.signal.aborted || await context.isCancelled()) throw context.signal.reason ?? new Error('Job cancelado.')
    if (organized.kind === 'rejected') throw new OrganizationInputTooLargeError()

    const revisionId = randomUUID()
    const committed = await commitHarnessJobResult(dependencies.repository, job, {
      expectedStatus: 'ORGANIZING',
      nextStatus: 'AWAITING_MARKDOWN_APPROVAL',
      runData: { activeMarkdownRevisionId: revisionId },
      write: async (transaction) => {
        const tx = transaction as OrganizationRepository
        const previous = await tx.markdownRevision.findFirst({
          where: { aiRunId: job.aiRunId },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
        const revision = await tx.markdownRevision.create({
          data: {
            id: revisionId,
            aiRunId: job.aiRunId,
            version: (previous?.version ?? 0) + 1,
            parentRevisionId: null,
            source: 'AI',
            content: organized.markdown,
            contentHash: organized.markdownHash,
            tokenCount: dependencies.limits.countTokens(organized.markdown),
            topics: deriveMarkdownTopics(organized.markdown),
            promptVersion: dependencies.promptVersion,
            model: dependencies.model,
          },
        })
        await tx.aiCallAttempt.create({
          data: {
            aiRunId: job.aiRunId,
            step: 'ORGANIZING',
            attempt: job.attempts,
            provider: dependencies.providerName,
            model: dependencies.model,
            promptVersion: dependencies.promptVersion,
            inputHash: job.inputHash,
            inputTokens: organized.inputMetrics.tokens,
            outputTokens: dependencies.limits.countTokens(organized.markdown),
            latencyMs: Math.max(0, now().getTime() - startedAt),
            technicalResult: 'SUCCESS',
          },
        })
        return revision
      },
    })
    if (committed.kind === 'stale') {
      metrics.increment('harness.job.stale_result', tags(job, dependencies))
      return { kind: 'stale' }
    }
    metrics.increment('harness.organization.success', tags(job, dependencies))
    return { kind: 'organized', revision: committed.value }
  } catch (error) {
    const errorCode = sanitizeErrorCode(error)
    await dependencies.repository.aiCallAttempt.create({
      data: {
        aiRunId: job.aiRunId,
        step: 'ORGANIZING',
        attempt: job.attempts,
        provider: dependencies.providerName,
        model: dependencies.model,
        promptVersion: dependencies.promptVersion,
        inputHash: job.inputHash,
        latencyMs: Math.max(0, now().getTime() - startedAt),
        technicalResult: error instanceof OrganizationInputTooLargeError ? 'INPUT_TOO_LARGE' : 'ERROR',
        errorCode,
      },
    })
    if (job.attempts >= job.maxAttempts || isPermanentOrganizationError(error)) {
      await dependencies.repository.aiRun.updateMany({
        where: {
          id: job.aiRunId,
          ownerId: job.ownerId,
          version: job.inputVersion,
          status: 'ORGANIZING',
          discardedAt: null,
        },
        data: {
          status: 'FAILED',
          failedStep: 'ORGANIZING',
          errorCode,
          retryable: !isPermanentOrganizationError(error),
        },
      })
    }
    metrics.increment('harness.organization.error', tags(job, dependencies))
    throw error
  } finally {
    metrics.observe('harness.organization.latency_ms', Math.max(0, now().getTime() - startedAt), tags(job, dependencies))
  }
}

async function beginOrganization(repository: OrganizationRepository, job: JobRecord) {
  if (!job.aiRunId || !job.ownerId || job.inputVersion === null || !job.inputHash || job.cancelledAt) return false
  const run = await repository.aiRun.findFirst({
    where: { id: job.aiRunId, ownerId: job.ownerId },
    select: { id: true, ownerId: true, status: true, version: true, discardedAt: true },
  })
  if (!run || run.version !== job.inputVersion || run.discardedAt !== null) return false
  if (run.status === 'ORGANIZING') return true
  if (run.status !== 'TRANSCRIBED') return false
  const started = await repository.aiRun.updateMany({
    where: { id: run.id, ownerId: job.ownerId, version: job.inputVersion, status: 'TRANSCRIBED', discardedAt: null },
    data: { status: 'ORGANIZING' },
  })
  return started.count === 1
}

function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

function tags(job: JobRecord, dependencies: OrganizationJobDependencies) {
  return {
    aiRunId: job.aiRunId ?? 'unknown',
    jobId: job.id,
    step: 'ORGANIZING',
    provider: dependencies.providerName,
    model: dependencies.model,
    promptVersion: dependencies.promptVersion,
  }
}

class OrganizationSnapshotMismatchError extends Error {
  constructor() {
    super('Transcricao difere do snapshot do job.')
    this.name = 'OrganizationSnapshotMismatchError'
  }
}

class OrganizationInputTooLargeError extends Error {
  constructor() {
    super('Transcricao excede limite configurado sem truncamento.')
    this.name = 'OrganizationInputTooLargeError'
  }
}

function isPermanentOrganizationError(error: unknown) {
  return error instanceof OrganizationSnapshotMismatchError || error instanceof OrganizationInputTooLargeError
}

function sanitizeErrorCode(error: unknown): string {
  const name = error instanceof Error ? error.name.toUpperCase().replace(/[^A-Z0-9_]/gu, '_') : ''
  return name && name.length <= 80 ? name : 'ORGANIZATION_ERROR'
}
