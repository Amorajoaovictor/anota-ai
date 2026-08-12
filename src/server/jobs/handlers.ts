import { z } from 'zod'
import { getAiProviders, readAiEnvironment } from '../ai/config'
import { recordAuditEvent } from '../audit-log'
import { getPrisma } from '../../lib/prisma'
import { getStorage } from '../storage'
import { enqueue } from './queue'
import type { JobRecord } from './queue'
import { cleanupHarnessAudio, processHarnessTranscription, sweepOrphanAudio } from '../ai/harness/transcription'
import { processHarnessOrganization } from '../ai/harness/organization-job'
import { buildOrganizerProvider } from '../ai/harness/organizer-provider'
import { readHarnessV2Config } from '../ai/harness/config'
import { processMaterializationJob, processRetrievalJob } from '../ai/harness/pipeline'
import { PrismaRetrievalProvider } from '../ai/harness/prisma-retrieval'
import { buildMaterializationProvider } from '../ai/harness/materialization-provider'
import { processHarnessExecutionStep, type HarnessExecutionStepJob } from '../ai/harness/executor'
import { createPrismaHarnessExecutionRepository } from '../ai/harness/prisma-executor'

export const JOB_TYPES = [
  'ai.classify',
  'audio.transcribe',
  'ai.organize',
  'ai.retrieve',
  'ai.materialize',
  'ai.execute',
  'ai.cleanup-audio',
  'ai.sweep-audio',
  'reminder.dispatch',
] as const

export type JobType = (typeof JOB_TYPES)[number]

export type JobHandlerContext = {
  signal: AbortSignal
  heartbeat(): Promise<boolean>
  isCancelled(): Promise<boolean>
}

export type JobHandler = (job: JobRecord, context?: JobHandlerContext) => Promise<void>

export class UnknownJobTypeError extends Error {
  constructor(type: string) {
    super(`Tipo de job desconhecido: ${type}`)
    this.name = 'UnknownJobTypeError'
  }
}

const classifyPayloadSchema = z.object({ inboxItemId: z.string().trim().min(1) })
const transcribePayloadSchema = z.object({
  inboxItemId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
})
const executionPayloadSchema = z.object({
  executionId: z.string().trim().min(1),
  ownerId: z.string().trim().min(1),
  aiRunId: z.string().trim().min(1),
  proposalRevisionId: z.string().trim().min(1),
  targetHash: z.string().trim().min(1),
  expectedRunVersion: z.number().int().nonnegative(),
  orderedItemIds: z.array(z.string().trim().min(1)).min(1).max(100),
  index: z.number().int().nonnegative(),
  localEntities: z.record(z.object({
    id: z.string().trim().min(1),
    entityType: z.string().trim().min(1),
    proposalItemId: z.string().trim().min(1),
    projectId: z.string().trim().min(1).optional(),
  }).strict()),
}).strict()

/** `reminder.dispatch` continua stub — é Fase 5. Classificação e transcrição têm corpo real desde a Fase 4. */
export const jobHandlers: Record<JobType, JobHandler> = {
  'ai.classify': handleAiClassify,
  'audio.transcribe': handleAudioTranscribe,
  'ai.organize': handleAiOrganize,
  'ai.retrieve': handleAiRetrieve,
  'ai.materialize': handleAiMaterialize,
  'ai.execute': handleAiExecute,
  'ai.cleanup-audio': (job) => cleanupHarnessAudio(getStorage(), job.payload),
  'ai.sweep-audio': async () => { await sweepOrphanAudio(getPrisma() as any, getStorage()) },
  'reminder.dispatch': (job) => recordJobRun(job),
}

export function isJobType(type: string): type is JobType {
  return (JOB_TYPES as readonly string[]).includes(type)
}

export function resolveHandler(type: string): JobHandler {
  if (!isJobType(type)) throw new UnknownJobTypeError(type)
  return jobHandlers[type]
}

async function recordJobRun(job: JobRecord) {
  await recordAuditEvent({
    action: 'job.executed',
    entityType: 'Job',
    entityId: job.id,
    metadata: { type: job.type, attempts: job.attempts },
  })
}

/**
 * Última tentativa permitida (mesma conta que `failJob` usa para decidir se
 * reenfileira). Só nela a entrada vira "Com erro" — antes disso o status some
 * na cara do usuário e volta sozinho quando a próxima tentativa funcionar.
 */
function isFinalAttempt(job: JobRecord) {
  return job.attempts >= job.maxAttempts
}

async function handleAiClassify(job: JobRecord) {
  const payload = classifyPayloadSchema.parse(job.payload)
  const prisma = getPrisma()

  try {
    const item = await prisma.inboxItem.findUnique({
      where: { id: payload.inboxItemId },
      select: { id: true, ownerId: true, text: true },
    })
    if (!item) return

    const [projects, tasks, contexts] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: item.ownerId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          aliases: { select: { value: true } },
          modules: { select: { name: true } },
          tags: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: { project: { ownerId: item.ownerId } },
        select: { id: true, title: true, project: { select: { name: true } } },
        take: 200,
      }),
      prisma.projectContext.findMany({
        where: { project: { ownerId: item.ownerId } },
        select: { id: true, projectId: true, category: true, title: true, content: true, project: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
    ])

    const { llm } = getAiProviders(readAiEnvironment())
    const suggestion = await llm.classify({
      text: item.text,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        aliases: project.aliases.map((alias) => alias.value),
        modules: project.modules.map((module) => module.name),
        tags: project.tags.map((tag) => tag.name),
      })),
      tasks: tasks.map((task) => ({ id: task.id, title: task.title, project: task.project.name })),
      contexts: contexts.map((context) => ({
        id: context.id,
        projectId: context.projectId,
        project: context.project.name,
        category: context.category,
        title: context.title,
        content: context.content,
      })),
    })

    await prisma.inboxItem.update({
      where: { id: payload.inboxItemId },
      data: { suggestion: JSON.parse(JSON.stringify(suggestion)), status: 'AWAITING_CONFIRMATION' },
    })
    await recordAuditEvent({
      action: 'inbox.classified',
      entityType: 'InboxItem',
      entityId: payload.inboxItemId,
      metadata: { confidence: suggestion.confidence, evidence: suggestion.evidence, actions: suggestion.actions.length },
    })
  } catch (error) {
    if (isFinalAttempt(job)) {
      await prisma.inboxItem.update({ where: { id: payload.inboxItemId }, data: { status: 'ERROR' } }).catch(() => undefined)
    }
    throw error
  }
}

async function handleAudioTranscribe(job: JobRecord, context?: JobHandlerContext) {
  if (job.aiRunId) {
    if (!context) throw new Error('Contexto cancelavel obrigatorio para transcricao v2.')
    const environment = readAiEnvironment()
    const harnessConfig = readHarnessV2Config(process.env)
    const { stt } = getAiProviders(environment)
    await processHarnessTranscription({
      repository: getPrisma() as any,
      storage: getStorage(),
      provider: stt,
      providerName: environment.STT_PROVIDER?.trim() || 'none',
      model: environment.GROQ_STT_MODEL?.trim() || (environment.STT_PROVIDER === 'groq' ? 'whisper-large-v3-turbo' : 'none'),
      organizationTimeoutMs: harnessConfig.timeouts.organizationMs,
      cleanupTimeoutMs: harnessConfig.timeouts.cleanupMs,
    }, job, context)
    return
  }

  const payload = transcribePayloadSchema.parse(job.payload)
  const prisma = getPrisma()
  const storage = getStorage()

  try {
    const bytes = await storage.read(payload.storageKey)
    if (!bytes) throw new Error('Áudio não encontrado no storage — pode já ter sido apagado por uma tentativa anterior.')

    const { stt } = getAiProviders(readAiEnvironment())
    const { text } = await stt.transcribe({ bytes, contentType: payload.contentType, signal: context?.signal })

    const item = await prisma.inboxItem.findUnique({ where: { id: payload.inboxItemId }, select: { text: true } })
    const combinedText = item?.text ? `${item.text}\n\n${text}` : text

    await prisma.inboxItem.update({
      where: { id: payload.inboxItemId },
      data: { text: combinedText, status: 'ANALYZING' },
    })
    // Sucesso: excluir o áudio agora mesmo (PRD 13.1/19.3) — a transcrição já está no texto do item.
    await storage.delete(payload.storageKey)
    await recordAuditEvent({ action: 'inbox.transcribed', entityType: 'InboxItem', entityId: payload.inboxItemId })
    await enqueue(prisma, { type: 'ai.classify', payload: { inboxItemId: payload.inboxItemId } })
  } catch (error) {
    if (isFinalAttempt(job)) {
      // Falha definitiva: sem provedor de STT real o áudio nunca vai transcrever sozinho, então
      // apaga aqui também — reter o arquivo indefinidamente contraria a retenção de 19.3.
      await prisma.inboxItem.update({ where: { id: payload.inboxItemId }, data: { status: 'ERROR' } }).catch(() => undefined)
      await storage.delete(payload.storageKey).catch(() => undefined)
    }
    throw error
  }
}

async function handleAiOrganize(job: JobRecord, context?: JobHandlerContext) {
  if (!context) throw new Error('Contexto cancelavel obrigatorio para organizacao v2.')
  const environment = { ...process.env }
  const providerName = environment.HARNESS_ORGANIZER_PROVIDER?.trim() || environment.LLM_PROVIDER?.trim() || 'lossless'
  const config = readHarnessV2Config(environment)
  await processHarnessOrganization({
    repository: getPrisma() as any,
    provider: buildOrganizerProvider(environment),
    limits: {
      ...config.organizerBudget,
      maxMarkdownCharacters: config.maxMarkdownCharacters,
      countTokens: (content) => Math.max(1, Math.ceil(content.length / 4)),
    },
    promptVersion: 'organizer-v1',
    timezone: 'America/Sao_Paulo',
    providerName,
    model: providerName === 'deepseek' ? (environment.DEEPSEEK_MODEL?.trim() || 'deepseek-chat') : 'lossless',
  }, job, context)
}

async function handleAiRetrieve(job: JobRecord, context?: JobHandlerContext) {
  if (!context) throw new Error('Contexto cancelavel obrigatorio para retrieval v2.')
  const prisma = getPrisma()
  const config = readHarnessV2Config(process.env)
  try {
    await processRetrievalJob(prisma, job, new PrismaRetrievalProvider(prisma), {
      materializationTimeoutMs: config.timeouts.materializationMs,
    })
  } catch (error) {
    await markHarnessStepFailed(job, error)
    throw error
  }
}

async function handleAiMaterialize(job: JobRecord, context?: JobHandlerContext) {
  if (!context) throw new Error('Contexto cancelavel obrigatorio para materializacao v2.')
  const environment = { ...process.env }
  const config = readHarnessV2Config(environment)
  const providerName = environment.HARNESS_MATERIALIZER_PROVIDER?.trim() || environment.LLM_PROVIDER?.trim() || 'deepseek'
  try {
    await processMaterializationJob(getPrisma(), job, buildMaterializationProvider(environment), {
      now: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
      promptVersion: 'materializer-v1',
      signal: context.signal,
      budget: config.materializerBudget,
      providerName,
      model: environment.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
    })
  } catch (error) {
    await markHarnessStepFailed(job, error)
    throw error
  }
}

async function handleAiExecute(job: JobRecord, context?: JobHandlerContext) {
  if (!context) throw new Error('Contexto cancelavel obrigatorio para execucao v2.')
  const payload = executionPayloadSchema.parse(job.payload) as HarnessExecutionStepJob
  try {
    const result = await processHarnessExecutionStep(
      createPrismaHarnessExecutionRepository(getPrisma() as any),
      payload,
    )
    if (result.kind === 'blocked') throw new Error(result.code ?? 'EXECUTION_BLOCKED')
    if (result.kind === 'failed') throw new Error(result.code ?? 'EXECUTION_FAILED')
  } catch (error) {
    if (isFinalAttempt(job)) await markHarnessStepFailed(job, error)
    throw error
  }
}

async function markHarnessStepFailed(job: JobRecord, error: unknown) {
  if (!job.aiRunId || !job.ownerId || !job.step || job.inputVersion === null || !isFinalAttempt(job)) return
  if (job.step !== 'RETRIEVING_REFERENCES' && job.step !== 'MATERIALIZING' && job.step !== 'EXECUTING') return
  const activeStatus = job.step === 'RETRIEVING_REFERENCES'
    ? 'RETRIEVING_REFERENCES'
    : job.step === 'MATERIALIZING' ? 'MATERIALIZING' : 'EXECUTING'
  await getPrisma().aiRun.updateMany({
    where: {
      id: job.aiRunId,
      ownerId: job.ownerId,
      version: job.inputVersion,
      status: activeStatus,
      discardedAt: null,
    },
    data: {
      status: 'FAILED',
      failedStep: activeStatus,
      errorCode: error instanceof Error ? error.name.toUpperCase() : 'PIPELINE_ERROR',
      retryable: true,
    },
  })
}
