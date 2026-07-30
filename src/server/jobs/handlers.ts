import { z } from 'zod'
import { getAiProviders, readAiEnvironment } from '../ai/config'
import { recordAuditEvent } from '../audit-log'
import { getPrisma } from '../../lib/prisma'
import { getStorage } from '../storage'
import { enqueue } from './queue'
import type { JobRecord } from './queue'

export const JOB_TYPES = ['ai.classify', 'audio.transcribe', 'reminder.dispatch'] as const

export type JobType = (typeof JOB_TYPES)[number]

export type JobHandler = (job: JobRecord) => Promise<void>

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

/** `reminder.dispatch` continua stub — é Fase 5. Classificação e transcrição têm corpo real desde a Fase 4. */
export const jobHandlers: Record<JobType, JobHandler> = {
  'ai.classify': handleAiClassify,
  'audio.transcribe': handleAudioTranscribe,
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

    const [projects, tasks] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: item.ownerId, status: 'ACTIVE' },
        select: {
          name: true,
          aliases: { select: { value: true } },
          modules: { select: { name: true } },
          tags: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: { project: { ownerId: item.ownerId } },
        select: { title: true, project: { select: { name: true } } },
        take: 200,
      }),
    ])

    const { llm } = getAiProviders(readAiEnvironment())
    const suggestion = await llm.classify({
      text: item.text,
      projects: projects.map((project) => ({
        name: project.name,
        aliases: project.aliases.map((alias) => alias.value),
        modules: project.modules.map((module) => module.name),
        tags: project.tags.map((tag) => tag.name),
      })),
      tasks: tasks.map((task) => ({ title: task.title, project: task.project.name })),
    })

    await prisma.inboxItem.update({
      where: { id: payload.inboxItemId },
      data: { suggestion: JSON.parse(JSON.stringify(suggestion)), status: 'AWAITING_CONFIRMATION' },
    })
    await recordAuditEvent({
      action: 'inbox.classified',
      entityType: 'InboxItem',
      entityId: payload.inboxItemId,
      metadata: { project: suggestion.project, confidence: suggestion.confidence, evidence: suggestion.evidence },
    })
  } catch (error) {
    if (isFinalAttempt(job)) {
      await prisma.inboxItem.update({ where: { id: payload.inboxItemId }, data: { status: 'ERROR' } }).catch(() => undefined)
    }
    throw error
  }
}

async function handleAudioTranscribe(job: JobRecord) {
  const payload = transcribePayloadSchema.parse(job.payload)
  const prisma = getPrisma()
  const storage = getStorage()

  try {
    const bytes = await storage.read(payload.storageKey)
    if (!bytes) throw new Error('Áudio não encontrado no storage — pode já ter sido apagado por uma tentativa anterior.')

    const { stt } = getAiProviders(readAiEnvironment())
    const { text } = await stt.transcribe({ bytes, contentType: payload.contentType })

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
