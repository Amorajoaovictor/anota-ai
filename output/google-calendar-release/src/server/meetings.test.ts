import { describe, expect, it, vi } from 'vitest'
import { createMeeting, listMeetings, removeMeeting, updateMeeting } from './meetings'

describe('reuniões persistidas', () => {
  it('lista apenas reuniões do dono, com projeto opcional para visão global', async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await listMeetings({ meeting: { findMany } }, 'user-1')

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { startsAt: 'asc' },
      include: { project: { select: { name: true, color: true } } },
    })
  })

  it('não cria reunião em projeto de outro dono', async () => {
    const create = vi.fn()
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue(null) },
      meeting: { create },
    }

    const result = await createMeeting(repo, 'user-1', {
      projectId: 'project-de-outro', title: 'Alinhamento', startsAt: '2026-09-15T10:00:00.000Z', timezone: 'America/Sao_Paulo',
    })

    expect(result).toEqual({ kind: 'project-not-found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejeita fim igual ou anterior ao início antes de gravar', async () => {
    const repo = {
      project: { findFirst: vi.fn() },
      meeting: { create: vi.fn() },
    }

    const result = await createMeeting(repo, 'user-1', {
      title: 'Alinhamento', startsAt: '2026-09-15T10:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', timezone: 'America/Sao_Paulo',
    })

    expect(result.kind).toBe('invalid')
    expect(repo.meeting.create).not.toHaveBeenCalled()
  })

  it('cria reunião avulsa e permite trocar projeto apenas para projeto do dono', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'meeting-1' })
    const update = vi.fn().mockResolvedValue({ id: 'meeting-1' })
    const repo = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-1' }) },
      meeting: {
        create,
        findFirst: vi.fn().mockResolvedValue({ id: 'meeting-1', projectId: null, startsAt: new Date('2026-09-15T10:00:00.000Z') }),
        update,
        delete: vi.fn(),
      },
    }

    await createMeeting(repo, 'user-1', { title: 'Alinhamento', startsAt: '2026-09-15T10:00:00.000Z', timezone: 'America/Sao_Paulo' })
    await updateMeeting(repo, 'user-1', 'meeting-1', { projectId: 'project-1', endsAt: '2026-09-15T11:00:00.000Z' })

    expect(create.mock.calls[0]![0].data).toMatchObject({ ownerId: 'user-1', projectId: null, title: 'Alinhamento' })
    expect(update.mock.calls[0]![0].data).toMatchObject({ projectId: 'project-1', endsAt: new Date('2026-09-15T11:00:00.000Z') })
  })

  it('recusa editar ou remover reunião de outro dono', async () => {
    const repo = {
      project: { findFirst: vi.fn() },
      meeting: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }

    expect(await updateMeeting(repo, 'user-1', 'meeting-de-outro', { title: 'Alterada' })).toEqual({ kind: 'not-found' })
    expect(await removeMeeting(repo, 'user-1', 'meeting-de-outro')).toEqual({ kind: 'not-found' })
    expect(repo.meeting.update).not.toHaveBeenCalled()
    expect(repo.meeting.delete).not.toHaveBeenCalled()
  })
})
