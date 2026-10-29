import { enqueue } from '../../jobs/queue'

type ApprovalRepository = {
  aiRun: {
    findFirst(args: any): Promise<any>
    updateMany(args: any): Promise<{ count: number }>
  }
  markdownRevision: {
    findFirst(args: any): Promise<any>
    update(args: any): Promise<any>
  }
  aiApproval: {
    findUnique(args: any): Promise<any>
    create(args: any): Promise<any>
  }
  job: {
    create(args: any): Promise<any>
    findUnique(args: any): Promise<any>
  }
  $transaction<T>(callback: (transaction: ApprovalRepository) => Promise<T>): Promise<T>
}

export type ApproveMarkdownInput = {
  revisionId: string
  targetHash: string
  expectedVersion: number
  queryVersion?: string
  retrievalTimeoutMs?: number
}

export type ApproveMarkdownResult =
  | { kind: 'approved'; approval: any }
  | { kind: 'already-approved'; approval: any }
  | { kind: 'not-found' }
  | { kind: 'stale-version' }
  | { kind: 'hash-mismatch' }
  | { kind: 'invalid-state' }

/** Aprova bytes exatos e cria proxima etapa dentro da mesma transacao. */
export async function approveMarkdownSnapshot(
  repository: ApprovalRepository,
  ownerId: string,
  aiRunId: string,
  input: ApproveMarkdownInput,
): Promise<ApproveMarkdownResult> {
  return repository.$transaction(async (transaction) => {
    const run = await transaction.aiRun.findFirst({
      where: { id: aiRunId, ownerId },
      select: { id: true, ownerId: true, status: true, version: true, activeMarkdownRevisionId: true },
    })
    if (!run) return { kind: 'not-found' }
    if (run.version !== input.expectedVersion) return { kind: 'stale-version' }
    if (run.activeMarkdownRevisionId !== input.revisionId) return { kind: 'stale-version' }

    const revision = await transaction.markdownRevision.findFirst({
      where: { id: input.revisionId, aiRunId },
      select: { id: true, aiRunId: true, contentHash: true, approvedAt: true },
    })
    if (!revision) return { kind: 'not-found' }
    if (revision.contentHash !== input.targetHash) return { kind: 'hash-mismatch' }

    const existing = await transaction.aiApproval.findUnique({
      where: { type_targetId: { type: 'MARKDOWN', targetId: revision.id } },
    })
    if (existing) {
      return existing.targetHash === input.targetHash
        ? { kind: 'already-approved', approval: existing }
        : { kind: 'hash-mismatch' }
    }
    if (run.status !== 'AWAITING_MARKDOWN_APPROVAL') return { kind: 'invalid-state' }

    const nextVersion = input.expectedVersion + 1
    const updated = await transaction.aiRun.updateMany({
      where: {
        id: aiRunId,
        ownerId,
        status: 'AWAITING_MARKDOWN_APPROVAL',
        version: input.expectedVersion,
      },
      data: { status: 'RETRIEVING_REFERENCES', version: { increment: 1 } },
    })
    if (updated.count === 0) return { kind: 'stale-version' }

    const now = new Date()
    const approval = await transaction.aiApproval.create({
      data: {
        aiRunId,
        ownerId,
        type: 'MARKDOWN',
        targetId: revision.id,
        targetHash: revision.contentHash,
        createdAt: now,
      },
    })
    await transaction.markdownRevision.update({ where: { id: revision.id }, data: { approvedAt: now } })

    const queryVersion = input.queryVersion ?? 'retrieval-v1'
    await enqueue(transaction, {
      type: 'ai.retrieve',
      payload: { markdownRevisionId: revision.id },
      ownerId,
      aiRunId,
      step: 'RETRIEVING_REFERENCES',
      inputVersion: nextVersion,
      inputHash: revision.contentHash,
      priority: 10,
      timeoutMs: input.retrievalTimeoutMs,
      dedupeKey: `retrieve:${aiRunId}:${revision.contentHash}:${queryVersion}`,
    })

    return { kind: 'approved', approval }
  })
}
