import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../lib/prisma', () => ({ getPrisma: () => ({ auditLog: { create: fakes.create } }) }))

import { recordAuditEvent } from './audit-log'

const dataOf = () => fakes.create.mock.calls[0]![0].data

describe('recordAuditEvent', () => {
  beforeEach(() => {
    fakes.create.mockReset().mockResolvedValue({ id: 'audit-1' })
  })

  it('grava o evento com ator e entidade', async () => {
    await recordAuditEvent({ actorId: 'user-1', action: 'task.created', entityType: 'Task', entityId: 'task-1' })

    expect(dataOf()).toMatchObject({
      actorId: 'user-1',
      action: 'task.created',
      entityType: 'Task',
      entityId: 'task-1',
    })
  })

  it('remove campos sensíveis do metadata antes de gravar', async () => {
    await recordAuditEvent({
      action: 'job.executed',
      entityType: 'Job',
      metadata: { type: 'ai.classify', token: 'segredo', nested: { apiKey: 'segredo', attempts: 2 } },
    })

    expect(dataOf().metadata).toEqual({ type: 'ai.classify', nested: { attempts: 2 } })
  })

  it('não grava metadata quando o evento não traz nenhum', async () => {
    await recordAuditEvent({ action: 'attachment.deleted', entityType: 'Attachment', entityId: 'attachment-1' })

    expect(dataOf().metadata).toBeUndefined()
  })
})
