import { describe, expect, it, vi } from 'vitest'
import { callMcpTool } from './tools'
describe('MCP reuniões', () => {
  it('bloqueia criar e agendar sem confirmação antes de tocar banco ou Google', async () => {
    const caller = { ownerId: 'owner', repository: {} as never }
    await expect(callMcpTool('meetings.create', { meeting: {} }, caller)).rejects.toThrow('CONFIRMATION_REQUIRED')
    await expect(callMcpTool('meetings.schedule', { id: 'm' }, caller)).rejects.toThrow('CONFIRMATION_REQUIRED')
  })
  it('lista apenas reuniões do dono do token', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    await callMcpTool('meetings.list', {}, { ownerId: 'owner', repository: { meeting: { findMany } } as never })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner' } }))
  })
  it('cria reunião local válida para posterior agendamento sem inferir duração', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'm' })
    const result = await callMcpTool('meetings.create', { confirmed: true, meeting: { title: 'Alinhamento', startsAt: '2030-01-01T13:00:00Z', durationMinutes: 30, timezone: 'America/Sao_Paulo' } }, { ownerId: 'owner', repository: { meeting: { create } } as never })
    expect(result).toMatchObject({ kind: 'created', meeting: { id: 'm' } })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner', durationMinutes: 30 }) }))
  })
})
