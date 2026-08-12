import { z } from 'zod'

export const harnessRunStatuses = [
  'RECEIVED',
  'TRANSCRIBING',
  'TRANSCRIBED',
  'ORGANIZING',
  'AWAITING_MARKDOWN_APPROVAL',
  'RETRIEVING_REFERENCES',
  'MATERIALIZING',
  'AWAITING_ENTITY_APPROVAL',
  'EXECUTING',
  'PROCESSED',
  'FAILED',
  'DISCARDED',
] as const

export const harnessRunStatusSchema = z.enum(harnessRunStatuses)
export type HarnessRunStatus = z.infer<typeof harnessRunStatusSchema>

const terminalStatuses = new Set<HarnessRunStatus>(['PROCESSED', 'DISCARDED'])
const normalTransitions: Record<HarnessRunStatus, readonly HarnessRunStatus[]> = {
  RECEIVED: ['TRANSCRIBING', 'TRANSCRIBED'],
  TRANSCRIBING: ['TRANSCRIBED'],
  TRANSCRIBED: ['ORGANIZING'],
  ORGANIZING: ['AWAITING_MARKDOWN_APPROVAL'],
  AWAITING_MARKDOWN_APPROVAL: ['RETRIEVING_REFERENCES'],
  RETRIEVING_REFERENCES: ['MATERIALIZING'],
  MATERIALIZING: ['AWAITING_ENTITY_APPROVAL'],
  AWAITING_ENTITY_APPROVAL: ['EXECUTING'],
  EXECUTING: ['PROCESSED'],
  PROCESSED: [],
  FAILED: [],
  DISCARDED: [],
}

export function isTerminalHarnessStatus(status: HarnessRunStatus): boolean {
  return terminalStatuses.has(status)
}

export function canTransitionHarnessRun(from: HarnessRunStatus, to: HarnessRunStatus): boolean {
  if (isTerminalHarnessStatus(from)) return false
  if (to === 'DISCARDED') return true
  if (to === 'FAILED') return from !== 'FAILED'
  return normalTransitions[from].includes(to)
}

export function assertHarnessTransition(from: HarnessRunStatus, to: HarnessRunStatus): void {
  if (!canTransitionHarnessRun(from, to)) throw new Error(`Transição inválida do harness: ${from} -> ${to}.`)
}

export function canRetryHarnessRun(status: HarnessRunStatus, failedStep: HarnessRunStatus | null, target: HarnessRunStatus): boolean {
  return status === 'FAILED' && failedStep !== null && failedStep === target && !isTerminalHarnessStatus(target)
}
