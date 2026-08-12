type HarnessReadRepository = {
  aiRun: { findFirst(args: any): Promise<any> }
}

export type HarnessPermissions = {
  editMarkdown: boolean
  approveMarkdown: boolean
  editProposal: boolean
  execute: boolean
  retry: boolean
  discard: boolean
}

export type HarnessReadResult =
  | { kind: 'not-found' }
  | { kind: 'found'; harness: any }

export async function getHarnessReadModel(
  repository: HarnessReadRepository,
  ownerId: string,
  inboxItemId: string,
): Promise<HarnessReadResult> {
  const run = await repository.aiRun.findFirst({
    where: { inboxItemId, ownerId },
    orderBy: { createdAt: 'desc' },
    include: {
      inboxItem: { select: { id: true, source: true, text: true, createdAt: true } },
      transcripts: { orderBy: { version: 'desc' }, take: 20 },
      markdownRevisions: { orderBy: { version: 'desc' }, take: 20 },
      proposalRevisions: {
        orderBy: { version: 'desc' },
        take: 20,
        include: { items: { orderBy: { createdAt: 'asc' } } },
      },
      approvals: { orderBy: { createdAt: 'asc' } },
      executions: { orderBy: { createdAt: 'desc' }, take: 1 },
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true, type: true, status: true, attempts: true, maxAttempts: true,
          runAt: true, step: true, inputVersion: true, inputHash: true, cancelledAt: true,
          lastError: true, createdAt: true, updatedAt: true,
        },
      },
    },
  })
  if (!run) return { kind: 'not-found' }

  return {
    kind: 'found',
    harness: {
      id: run.id,
      inboxItemId: run.inboxItemId,
      status: run.status,
      version: run.version,
      failedStep: run.failedStep,
      errorCode: run.errorCode,
      retryable: run.retryable,
      discardedAt: run.discardedAt,
      processedAt: run.processedAt,
      original: run.inboxItem,
      transcript: activeById(run.transcripts, run.activeTranscriptId),
      markdown: activeById(run.markdownRevisions, run.activeMarkdownRevisionId),
      proposal: activeById(run.proposalRevisions, run.activeProposalRevisionId),
      revisions: {
        transcripts: run.transcripts,
        markdown: run.markdownRevisions,
        proposals: run.proposalRevisions,
      },
      approvals: run.approvals,
      execution: run.executions[0] ?? null,
      jobs: run.jobs,
      permissions: permissionsFor(run.status, run.retryable),
    },
  }
}

function activeById<T extends { id: string }>(items: T[], activeId: string | null): T | null {
  if (!activeId) return null
  return items.find((item) => item.id === activeId) ?? null
}

export function permissionsFor(status: string, retryable: boolean): HarnessPermissions {
  const terminal = status === 'PROCESSED' || status === 'DISCARDED'
  const markdownEditable = [
    'AWAITING_MARKDOWN_APPROVAL',
    'RETRIEVING_REFERENCES',
    'MATERIALIZING',
    'AWAITING_ENTITY_APPROVAL',
    'FAILED',
  ].includes(status)
  return {
    editMarkdown: markdownEditable,
    approveMarkdown: status === 'AWAITING_MARKDOWN_APPROVAL',
    editProposal: status === 'AWAITING_ENTITY_APPROVAL',
    execute: status === 'AWAITING_ENTITY_APPROVAL',
    retry: status === 'FAILED' && retryable,
    discard: !terminal,
  }
}
