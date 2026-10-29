import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../../server/http'
import { jsonRequest } from '../../../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  inboxFindFirst: vi.fn(),
  inboxUpdate: vi.fn(),
  projectFindFirst: vi.fn(),
  taskCreate: vi.fn(),
  noteFindFirst: vi.fn(),
  milestoneFindMany: vi.fn(),
  projectTagFindMany: vi.fn(),
  projectTagUpsert: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  transaction: vi.fn(),
  executeApprovedAiPlan: vi.fn(),
}))

vi.mock('../../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../../lib/prisma', () => ({
  getPrisma: () => ({
    $transaction: fakes.transaction,
    inboxItem: { findFirst: fakes.inboxFindFirst, update: fakes.inboxUpdate },
    project: { findFirst: fakes.projectFindFirst },
    task: { create: fakes.taskCreate },
    note: { findFirst: fakes.noteFindFirst },
    milestone: { findMany: fakes.milestoneFindMany },
    projectTag: { findMany: fakes.projectTagFindMany, upsert: fakes.projectTagUpsert },
  }),
}))
vi.mock('../../../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))
vi.mock('../../../../../server/ai/plan-executor', () => ({ executeApprovedAiPlan: fakes.executeApprovedAiPlan }))

import { POST } from './route'

const url = 'http://localhost/api/inbox/inbox-1/confirm'
const context = () => ({ params: Promise.resolve({ id: 'inbox-1' }) })
const confirm = (body: unknown) => POST(jsonRequest(url, body), context())

describe('POST /api/inbox/[id]/confirm', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.inboxFindFirst.mockReset().mockResolvedValue({
      id: 'inbox-1', status: 'AWAITING_CONFIRMATION', suggestion: { project: 'VistaFor' },
    })
    fakes.inboxUpdate.mockReset().mockResolvedValue({ id: 'inbox-1', status: 'PROCESSED' })
    fakes.projectFindFirst.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.taskCreate.mockReset().mockResolvedValue({ id: 'task-1', title: 'Revisar mapa' })
    fakes.noteFindFirst.mockReset()
    fakes.milestoneFindMany.mockReset().mockResolvedValue([])
    fakes.projectTagFindMany.mockReset().mockResolvedValue([])
    fakes.projectTagUpsert.mockReset()
    fakes.recordAuditEvent.mockClear()
    fakes.transaction.mockReset().mockImplementation((callback) => callback({}))
    fakes.executeApprovedAiPlan.mockReset()
  })

  it('responde 401 sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    expect((await confirm({ projectId: 'project-1', title: 'Revisar mapa' })).status).toBe(401)
  })

  it('responde 404 para entrada de outro dono', async () => {
    fakes.inboxFindFirst.mockResolvedValueOnce(null)

    expect((await confirm({ projectId: 'project-1', title: 'Revisar mapa' })).status).toBe(404)
  })

  it('responde 409 quando a entrada ainda não tem proposta', async () => {
    fakes.inboxFindFirst.mockResolvedValueOnce({ id: 'inbox-1', status: 'ANALYZING', suggestion: null })

    expect((await confirm({ projectId: 'project-1', title: 'Revisar mapa' })).status).toBe(409)
  })

  it('responde 400 para corpo inválido', async () => {
    const response = await confirm({ title: 'Sem projeto' })

    expect(response.status).toBe(400)
    expect(fakes.taskCreate).not.toHaveBeenCalled()
  })

  it('responde 400 quando o projeto não existe', async () => {
    fakes.projectFindFirst.mockResolvedValueOnce(null)

    expect((await confirm({ projectId: 'project-de-outro', title: 'Revisar mapa' })).status).toBe(400)
  })

  it('confirma, cria o card e registra auditoria com o id da tarefa', async () => {
    const response = await confirm({ projectId: 'project-1', title: 'Revisar mapa' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      inboxItem: { id: 'inbox-1', status: 'PROCESSED' },
      task: { id: 'task-1', title: 'Revisar mapa' },
    })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inbox.confirmed',
      entityType: 'InboxItem',
      entityId: 'inbox-1',
      metadata: { taskId: 'task-1' },
    }))
  })

  it('confirmar de novo devolve o estado atual sem registrar auditoria nem criar outro card', async () => {
    fakes.inboxFindFirst.mockResolvedValueOnce({ id: 'inbox-1', status: 'PROCESSED', suggestion: { project: 'VistaFor' } })

    const response = await confirm({ projectId: 'project-1', title: 'Revisar mapa' })

    expect(response.status).toBe(200)
    expect(fakes.taskCreate).not.toHaveBeenCalled()
    expect(fakes.recordAuditEvent).not.toHaveBeenCalled()
  })

  it('executa proposta multi-entidade em transação e devolve todas as criações', async () => {
    const plan = {
      summary: 'Contextos e tarefas.', confidence: 90, evidence: ['x'],
      actions: [{ id: 'context-1', entity: 'context', operation: 'create', dependsOn: [], confidence: 90, evidence: ['x'], data: {} }],
    }
    fakes.executeApprovedAiPlan.mockResolvedValue({
      kind: 'executed', inboxItem: { id: 'inbox-1', status: 'PROCESSED' },
      created: [{ actionId: 'context-1', entity: 'context', id: 'db-context-1', projectId: 'project-1' }],
    })

    const response = await confirm(plan)

    expect(response.status).toBe(201)
    expect(fakes.transaction).toHaveBeenCalledOnce()
    expect(fakes.executeApprovedAiPlan).toHaveBeenCalledWith({}, 'user-1', 'inbox-1', plan)
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'inbox.plan.executed' }))
  })
})
