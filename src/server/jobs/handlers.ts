import { recordAuditEvent } from '../audit-log'
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

/**
 * Fase 2 entrega apenas o transporte. Cada stub registra a execução em auditoria;
 * a classificação (Fase 4), a transcrição (Fase 4) e os lembretes (Fase 5) substituem o corpo.
 */
export const jobHandlers: Record<JobType, JobHandler> = {
  'ai.classify': (job) => recordJobRun(job),
  'audio.transcribe': (job) => recordJobRun(job),
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
