import { HARNESS_PROPOSAL_SCHEMA_VERSION } from './contracts'
import { canonicalizeMarkdown, hashMarkdown } from './hash'
import type { HarnessRunStatus } from './state-machine'

export type HarnessApproval = {
  type: 'MARKDOWN' | 'ENTITIES'
  targetId: string
  targetHash: string
}

type ExecutionReadiness = {
  status: HarnessRunStatus
  markdownRevision: { id: string; contentHash: string }
  proposalRevision: { id: string; contentHash: string }
  approvals: HarnessApproval[]
}

function hasExactApproval(
  approvals: HarnessApproval[],
  type: HarnessApproval['type'],
  target: { id: string; contentHash: string },
): boolean {
  return approvals.some((approval) => (
    approval.type === type
    && approval.targetId === target.id
    && approval.targetHash === target.contentHash
  ))
}

export function canExecuteApprovedProposal(input: ExecutionReadiness): boolean {
  return input.status === 'AWAITING_ENTITY_APPROVAL'
    && hasExactApproval(input.approvals, 'MARKDOWN', input.markdownRevision)
    && hasExactApproval(input.approvals, 'ENTITIES', input.proposalRevision)
}

type MaterializationInputSource = {
  approvedMarkdownRevision: { id: string; content: string; contentHash: string }
  markdownApproval: HarnessApproval
  retrievalSnapshot: { id: string; contentHash: string; references: unknown[] }
  schemaVersion: typeof HARNESS_PROPOSAL_SCHEMA_VERSION
  now: string
  timezone: string
}

export type MaterializationInput = {
  schemaVersion: typeof HARNESS_PROPOSAL_SCHEMA_VERSION
  approvedMarkdown: string
  approvedMarkdownHash: string
  retrievalSnapshot: {
    marker: 'REFERENCE_ONLY'
    id: string
    contentHash: string
    references: unknown[]
  }
  now: string
  timezone: string
}

/** Monta entrada da LLM 2 sem aceitar transcrição ou revisão antiga como parâmetro. */
export function buildMaterializationInput(input: MaterializationInputSource): MaterializationInput {
  const approvedMarkdown = canonicalizeMarkdown(input.approvedMarkdownRevision.content)
  const approvedMarkdownHash = hashMarkdown(approvedMarkdown)
  if (approvedMarkdownHash !== input.approvedMarkdownRevision.contentHash) {
    throw new Error('Hash da revisão de Markdown não corresponde ao conteúdo aprovado.')
  }
  if (
    input.markdownApproval.type !== 'MARKDOWN'
    || input.markdownApproval.targetId !== input.approvedMarkdownRevision.id
    || input.markdownApproval.targetHash !== approvedMarkdownHash
  ) {
    throw new Error('Aprovação não corresponde à revisão exata de Markdown.')
  }

  return {
    schemaVersion: input.schemaVersion,
    approvedMarkdown,
    approvedMarkdownHash,
    retrievalSnapshot: {
      marker: 'REFERENCE_ONLY',
      id: input.retrievalSnapshot.id,
      contentHash: input.retrievalSnapshot.contentHash,
      references: input.retrievalSnapshot.references,
    },
    now: input.now,
    timezone: input.timezone,
  }
}
