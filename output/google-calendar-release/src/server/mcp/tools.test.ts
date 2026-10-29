import { describe, expect, it, vi } from 'vitest'
import { callMcpTool } from './tools'

describe('MCP tools', () => {
  it('lista projetos somente do dono autenticado', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'project-1', name: 'Observa' }])
    const result = await callMcpTool('projects.list', { limit: 20, offset: 10 }, {
      ownerId: 'owner-1',
      repository: { project: { findMany } } as never,
    })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1' }, take: 20, skip: 10 }))
    expect(result).toEqual({ projects: [{ id: 'project-1', name: 'Observa' }] })
  })

  it('consulta cards, contexto e inbox com filtro pelo dono', async () => {
    const taskFindMany = vi.fn().mockResolvedValue([])
    const contextFindMany = vi.fn().mockResolvedValue([])
    const inboxFindMany = vi.fn().mockResolvedValue([])
    const repository = {
      task: { findMany: taskFindMany },
      projectContext: { findMany: contextFindMany },
      inboxItem: { findMany: inboxFindMany },
    } as never
    const caller = { ownerId: 'owner-1', repository }

    await callMcpTool('tasks.list', {}, caller)
    await callMcpTool('context.list', {}, caller)
    await callMcpTool('inbox.list', {}, caller)

    expect(taskFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { project: { ownerId: 'owner-1' } }, take: 50, skip: 0 }))
    expect(contextFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { project: { ownerId: 'owner-1' } }, take: 50, skip: 0 }))
    expect(inboxFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1' }, take: 50, skip: 0 }))
  })

  it('não expõe notas privadas como ferramenta', async () => {
    await expect(callMcpTool('notes.list', {}, { ownerId: 'owner-1', repository: {} as never }))
      .rejects.toThrow('Ferramenta MCP desconhecida: notes.list')
  })

  it('bloqueia alteração de prazo sem confirmação declarada pelo agente', async () => {
    const update = vi.fn()
    const repository = { task: { update } } as never
    await expect(callMcpTool('tasks.update', {
      id: 'task-1', patch: { dueAt: '2030-01-01T00:00:00.000Z' },
    }, { ownerId: 'owner-1', repository })).rejects.toThrow('CONFIRMATION_REQUIRED')
    expect(update).not.toHaveBeenCalled()
  })

  it('exige confirmação reforçada para baixar prioridade existente', async () => {
    const update = vi.fn()
    await expect(callMcpTool('tasks.update', { id: 'task-1', patch: { priority: 'P3' }, confirmed: true }, {
      ownerId: 'owner-1', repository: { task: { update } } as never,
    })).rejects.toThrow('CONFIRMATION_REQUIRED')
    expect(update).not.toHaveBeenCalled()
  })

  it('cria projeto pelo serviço de domínio com o dono do token', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'project-1', name: 'Observa' })
    const result = await callMcpTool('projects.create', { name: 'Observa', confirmed: true }, {
      ownerId: 'owner-1', repository: { project: { create } } as never,
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner-1' }) }))
    expect(result).toMatchObject({ kind: 'created', project: { id: 'project-1' } })
  })

  it('não confirma entrada sem autorização explícita da conversa', async () => {
    const findFirst = vi.fn()
    await expect(callMcpTool('inbox.confirm', { id: 'inbox-1', task: { projectId: 'project-1', title: 'Card' } }, {
      ownerId: 'owner-1', repository: { inboxItem: { findFirst } } as never,
    })).rejects.toThrow('CONFIRMATION_REQUIRED')
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('lê revisão IA somente da entrada do usuário', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const result = await callMcpTool('inbox.harness', { id: 'inbox-1' }, {
      ownerId: 'owner-1', repository: { aiRun: { findFirst } } as never,
    })
    expect(result).toEqual({ kind: 'not-found' })
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { inboxItemId: 'inbox-1', ownerId: 'owner-1' } }))
  })

  it('busca cards semelhantes sem consultar cards de outro usuário', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    await callMcpTool('tasks.search_similar', { query: 'planta principal', projectId: 'project-1' }, {
      ownerId: 'owner-1', repository: { task: { findMany } } as never,
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ project: { ownerId: 'owner-1' }, projectId: 'project-1' }),
      take: 100,
    }))
  })
})
