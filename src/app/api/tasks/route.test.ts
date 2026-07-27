import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../server/http'
import { jsonRequest } from '../../../test/request'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  findFirstProject: vi.fn(),
  createTask: vi.fn(),
  findManyTasks: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../lib/prisma', () => ({
  getPrisma: () => ({
    project: { findFirst: fakes.findFirstProject },
    task: { create: fakes.createTask, findMany: fakes.findManyTasks },
  }),
}))
vi.mock('../../../server/audit-log', () => ({ recordAuditEvent: fakes.recordAuditEvent }))

import { GET, POST } from './route'

const url = 'http://localhost/api/tasks'
const validInput = { projectId: 'project-1', title: 'Impedir carregamento automático da planta' }

describe('rotas de cards', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('user-1')
    fakes.findFirstProject.mockReset().mockResolvedValue({ id: 'project-1' })
    fakes.createTask.mockReset()
    fakes.findManyTasks.mockReset().mockResolvedValue([])
    fakes.recordAuditEvent.mockClear()
  })

  it('responde 401 na listagem sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(401)
    expect(fakes.findManyTasks).not.toHaveBeenCalled()
  })

  it('responde 401 na criação sem sessão', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())

    const response = await POST(jsonRequest(url, validInput), undefined)

    expect(response.status).toBe(401)
    expect(fakes.createTask).not.toHaveBeenCalled()
  })

  it('lista somente os cards do dono da sessão', async () => {
    const response = await GET(new Request(url), undefined)

    expect(response.status).toBe(200)
    expect(fakes.findManyTasks).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project: { ownerId: 'user-1' } } }),
    )
  })

  it('responde 400 para corpo que não é JSON', async () => {
    const response = await POST(new Request(url, { method: 'POST', body: 'nao-json{' }), undefined)

    expect(response.status).toBe(400)
    expect(fakes.createTask).not.toHaveBeenCalled()
  })

  it('responde 400 com as issues de validação', async () => {
    const response = await POST(jsonRequest(url, { projectId: 'project-1', title: '  ' }), undefined)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Dados inválidos.',
      issues: ['Título do card é obrigatório.'],
    })
    expect(fakes.createTask).not.toHaveBeenCalled()
  })

  it('responde 404 quando o projeto não pertence ao dono', async () => {
    fakes.findFirstProject.mockResolvedValueOnce(null)

    const response = await POST(jsonRequest(url, validInput), undefined)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Projeto não encontrado.' })
    expect(fakes.createTask).not.toHaveBeenCalled()
  })

  it('responde 500 sem detalhes quando o banco falha', async () => {
    fakes.createTask.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.4:5432'))

    const response = await POST(jsonRequest(url, validInput), undefined)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Erro interno.' })
    expect(fakes.recordAuditEvent).not.toHaveBeenCalled()
  })

  it('cria card e registra auditoria', async () => {
    fakes.createTask.mockResolvedValueOnce({ id: 'task-1', title: validInput.title })

    const response = await POST(jsonRequest(url, validInput), undefined)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ task: { id: 'task-1' } })
    expect(fakes.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'user-1', action: 'task.created', entityId: 'task-1' }),
    )
  })
})
