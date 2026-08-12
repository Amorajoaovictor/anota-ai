import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { SttProvider } from '../provider'
import { enqueue, type JobRecord, type JobRepository } from '../../jobs/queue'
import type { JobHandlerContext } from '../../jobs/handlers'
import type { StorageDriver } from '../../storage'
import { commitHarnessJobResult } from './orchestration'
import { noopTechnicalMetrics, type TechnicalMetrics } from './metrics'

const supportedAudioTypes = new Set([
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
])

const transcriptionPayloadSchema = z.object({
  storageKey: z.string().startsWith('inbox-audio/'),
  contentType: z.string().min(1),
  inputBytes: z.number().int().positive(),
}).strict()

export type HarnessAudioValidation =
  | { kind: 'valid'; contentType: string }
  | { kind: 'empty' }
  | { kind: 'too-large' }
  | { kind: 'unsupported-type' }

export function validateHarnessAudio(bytes: Uint8Array, contentType: string, maxBytes: number): HarnessAudioValidation {
  if (bytes.byteLength === 0) return { kind: 'empty' }
  if (bytes.byteLength > maxBytes) return { kind: 'too-large' }
  const normalized = contentType.split(';')[0]!.trim().toLowerCase()
  if (!supportedAudioTypes.has(normalized)) return { kind: 'unsupported-type' }
  return { kind: 'valid', contentType: normalized }
}

export function hashAudioBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

type TranscriptRecord = {
  id: string
  aiRunId: string
  version: number
  text: string
  contentHash: string
  source: 'STT'
}

type TranscriptionRepository = JobRepository & {
  aiRun: {
    findFirst(args: any): Promise<{ id: string; ownerId: string; status: string; version: number; discardedAt: Date | null } | null>
    updateMany(args: any): Promise<{ count: number }>
  }
  transcriptRevision: {
    findFirst(args: any): Promise<{ version: number } | null>
    create(args: any): Promise<TranscriptRecord>
  }
  aiCallAttempt?: { create(args: any): Promise<unknown> }
  $transaction<T>(callback: (transaction: TranscriptionRepository) => Promise<T>): Promise<T>
}

export type ProcessHarnessTranscriptionDependencies = {
  repository: TranscriptionRepository
  storage: Pick<StorageDriver, 'read' | 'delete'>
  provider: SttProvider
  providerName: string
  model: string
  metrics?: TechnicalMetrics
  now?: () => Date
  organizationTimeoutMs?: number
  cleanupTimeoutMs?: number
}

export type ProcessHarnessTranscriptionResult =
  | { kind: 'transcribed'; transcript: TranscriptRecord }
  | { kind: 'stale' }

export async function processHarnessTranscription(
  dependencies: ProcessHarnessTranscriptionDependencies,
  job: JobRecord,
  context: JobHandlerContext,
): Promise<ProcessHarnessTranscriptionResult> {
  const { repository, storage, provider } = dependencies
  const metrics = dependencies.metrics ?? noopTechnicalMetrics
  const now = dependencies.now ?? (() => new Date())
  const startedAt = now().getTime()
  const payload = transcriptionPayloadSchema.parse(job.payload)

  if (!isCurrentTranscriptionJob(await readRun(repository, job), job) || await context.isCancelled()) {
    metrics.increment('harness.job.stale_result', metricTags(job, dependencies))
    return { kind: 'stale' }
  }

  let resultType = 'RETRY'
  try {
    const bytes = await storage.read(payload.storageKey)
    if (!bytes) throw new AudioMissingError()
    if (bytes.byteLength !== payload.inputBytes || hashAudioBytes(bytes) !== job.inputHash) {
      throw new AudioSnapshotMismatchError()
    }
    if (context.signal.aborted || await context.isCancelled()) throw context.signal.reason ?? new Error('Job cancelado.')

    const providerResult = await provider.transcribe({ bytes, contentType: payload.contentType, signal: context.signal })
    if (context.signal.aborted || await context.isCancelled()) throw context.signal.reason ?? new Error('Job cancelado.')
    const text = providerResult.text.trim()
    if (!text) throw new EmptyTranscriptionError()
    const transcriptId = randomUUID()
    const contentHash = createHash('sha256').update(text, 'utf8').digest('hex')

    const committed = await commitHarnessJobResult(repository, job, {
      expectedStatus: 'TRANSCRIBING',
      nextStatus: 'TRANSCRIBED',
      runData: { activeTranscriptId: transcriptId },
      write: async (transaction) => {
        const tx = transaction as TranscriptionRepository
        const previous = await tx.transcriptRevision.findFirst({
          where: { aiRunId: job.aiRunId },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
        const transcript = await tx.transcriptRevision.create({
          data: {
            id: transcriptId,
            aiRunId: job.aiRunId,
            version: (previous?.version ?? 0) + 1,
            text,
            contentHash,
            source: 'STT',
            provider: dependencies.providerName,
            model: dependencies.model,
            inputBytes: bytes.byteLength,
            tokenCount: approximateTokens(text),
          },
        })
        await enqueue(tx, {
          type: 'ai.organize',
          payload: { transcriptRevisionId: transcript.id },
          dedupeKey: `${job.aiRunId}:ORGANIZING:${(job.inputVersion ?? 0) + 1}:${contentHash}`,
          ownerId: job.ownerId ?? undefined,
          aiRunId: job.aiRunId ?? undefined,
          step: 'ORGANIZING',
          inputVersion: (job.inputVersion ?? 0) + 1,
          inputHash: contentHash,
          priority: 10,
          timeoutMs: dependencies.organizationTimeoutMs ?? 60_000,
        })
        return transcript
      },
    })

    if (committed.kind === 'stale') {
      resultType = 'STALE'
      metrics.increment('harness.job.stale_result', metricTags(job, dependencies))
      await cleanupAudio(repository, storage, payload.storageKey, job, metrics, dependencies.cleanupTimeoutMs)
      return { kind: 'stale' }
    }

    resultType = 'SUCCESS'
    await cleanupAudio(repository, storage, payload.storageKey, job, metrics, dependencies.cleanupTimeoutMs)
    return { kind: 'transcribed', transcript: committed.value }
  } catch (error) {
    const finalAttempt = job.attempts >= job.maxAttempts || isPermanentAudioError(error)
    resultType = finalAttempt ? 'FAILED' : 'RETRY'
    if (finalAttempt) {
      await repository.aiRun.updateMany({
        where: {
          id: job.aiRunId,
          ownerId: job.ownerId,
          version: job.inputVersion,
          status: 'TRANSCRIBING',
          discardedAt: null,
        },
        data: {
          status: 'FAILED',
          version: { increment: 1 },
          failedStep: 'TRANSCRIBING',
          errorCode: technicalErrorCode(error),
          retryable: false,
        },
      })
      await cleanupAudio(repository, storage, payload.storageKey, job, metrics, dependencies.cleanupTimeoutMs)
    }
    metrics.increment('harness.transcription.error', { ...metricTags(job, dependencies), result: resultType })
    throw error
  } finally {
    const latencyMs = Math.max(0, now().getTime() - startedAt)
    metrics.observe('harness.transcription.latency_ms', latencyMs, metricTags(job, dependencies))
    await recordTechnicalAttempt(repository, job, dependencies, resultType, latencyMs).catch(() => undefined)
  }
}

async function readRun(repository: TranscriptionRepository, job: JobRecord) {
  if (!job.aiRunId || !job.ownerId) return null
  return repository.aiRun.findFirst({
    where: { id: job.aiRunId, ownerId: job.ownerId },
    select: { id: true, ownerId: true, status: true, version: true, discardedAt: true },
  })
}

function isCurrentTranscriptionJob(
  run: Awaited<ReturnType<typeof readRun>>,
  job: JobRecord,
): boolean {
  return Boolean(
    run
    && run.status === 'TRANSCRIBING'
    && run.version === job.inputVersion
    && run.discardedAt === null
    && !job.cancelledAt,
  )
}

async function cleanupAudio(
  repository: TranscriptionRepository,
  storage: Pick<StorageDriver, 'delete'>,
  storageKey: string,
  job: JobRecord,
  metrics: TechnicalMetrics,
  cleanupTimeoutMs = 30_000,
) {
  try {
    await storage.delete(storageKey)
  } catch {
    metrics.increment('harness.audio.cleanup_failed', { aiRunId: job.aiRunId ?? 'unknown' })
    await enqueue(repository, {
      type: 'ai.cleanup-audio',
      payload: { storageKey },
      dedupeKey: `cleanup:${storageKey}`,
      ownerId: job.ownerId ?? undefined,
      aiRunId: job.aiRunId ?? undefined,
      step: 'CLEANING_AUDIO',
      inputVersion: job.inputVersion ?? undefined,
      inputHash: job.inputHash ?? undefined,
      priority: 20,
      maxAttempts: 10,
      timeoutMs: cleanupTimeoutMs,
    })
  }
}

async function recordTechnicalAttempt(
  repository: TranscriptionRepository,
  job: JobRecord,
  dependencies: ProcessHarnessTranscriptionDependencies,
  technicalResult: string,
  latencyMs: number,
) {
  if (!repository.aiCallAttempt || !job.aiRunId || !job.inputHash) return
  await repository.aiCallAttempt.create({
    data: {
      aiRunId: job.aiRunId,
      step: 'TRANSCRIBING',
      attempt: job.attempts,
      provider: dependencies.providerName,
      model: dependencies.model,
      inputHash: job.inputHash,
      latencyMs,
      technicalResult,
      errorCode: technicalResult === 'SUCCESS' ? null : technicalResult,
    },
  })
}

function metricTags(job: JobRecord, dependencies: ProcessHarnessTranscriptionDependencies) {
  return {
    aiRunId: job.aiRunId ?? 'unknown',
    jobId: job.id,
    step: 'TRANSCRIBING',
    provider: dependencies.providerName,
    model: dependencies.model,
  }
}

function approximateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

class AudioMissingError extends Error {
  constructor() {
    super('Audio temporario nao encontrado.')
    this.name = 'AudioMissingError'
  }
}

class AudioSnapshotMismatchError extends Error {
  constructor() {
    super('Audio temporario difere do snapshot do job.')
    this.name = 'AudioSnapshotMismatchError'
  }
}

class EmptyTranscriptionError extends Error {
  constructor() {
    super('Provedor devolveu transcricao vazia.')
    this.name = 'EmptyTranscriptionError'
  }
}

function isPermanentAudioError(error: unknown) {
  return error instanceof AudioMissingError || error instanceof AudioSnapshotMismatchError || error instanceof EmptyTranscriptionError
}

function technicalErrorCode(error: unknown) {
  return error instanceof Error ? error.name.toUpperCase() : 'STT_ERROR'
}

type SweeperRepository = {
  job: { findMany(args: any): Promise<Array<{ payload: unknown }>> }
}

type SweepableStorage = Pick<StorageDriver, 'delete'> & {
  list(prefix: string): Promise<Array<{ key: string; updatedAt: Date }>>
}

export async function sweepOrphanAudio(
  repository: SweeperRepository,
  storage: SweepableStorage,
  options: { now?: Date; maxAgeMs?: number; metrics?: TechnicalMetrics } = {},
) {
  const now = options.now ?? new Date()
  const maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60_000
  const entries = await storage.list('inbox-audio/')
  const activeJobs = await repository.job.findMany({
    where: { type: 'audio.transcribe', status: { in: ['PENDING', 'RUNNING'] }, cancelledAt: null },
    select: { payload: true },
  })
  const activeKeys = new Set(activeJobs.flatMap((job) => readStorageKey(job.payload)))
  const expired = entries.filter((entry) => (
    now.getTime() - entry.updatedAt.getTime() >= maxAgeMs && !activeKeys.has(entry.key)
  ))
  const results = await Promise.allSettled(expired.map((entry) => storage.delete(entry.key)))
  const failed = results.filter((entry) => entry.status === 'rejected').length
  const deleted = results.length - failed
  options.metrics?.observe('harness.audio.orphans', expired.length, {})
  options.metrics?.increment('harness.audio.sweeper_run', { scanned: entries.length, deleted, failed })
  return { scanned: entries.length, deleted, failed }
}

export async function cleanupHarnessAudio(storage: Pick<StorageDriver, 'delete'>, payload: unknown) {
  const parsed = z.object({ storageKey: z.string().startsWith('inbox-audio/') }).strict().parse(payload)
  await storage.delete(parsed.storageKey)
}

function readStorageKey(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || !('storageKey' in payload)) return []
  return typeof payload.storageKey === 'string' && payload.storageKey.startsWith('inbox-audio/') ? [payload.storageKey] : []
}
