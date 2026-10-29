import { describe, expect, it, vi } from 'vitest'
import { scheduleGoogleMeeting } from './google-meetings'
const mocks = vi.hoisted(() => ({ exchangeGoogleToken: vi.fn(), createCalendarEvent: vi.fn(), openToken: vi.fn(), googleConfig: vi.fn() }))
vi.mock('./google-calendar', () => mocks)
describe('agendar reunião Google por dono', () => {
  it('não consulta credenciais nem Google para reunião de outro dono', async () => {
    const repo = { meeting: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() }, googleCalendarConnection: { findUnique: vi.fn() } }
    expect(await scheduleGoogleMeeting(repo as never, 'owner', 'other-meeting', 'request')).toEqual({ kind: 'not-found' })
    expect(repo.meeting.findFirst).toHaveBeenCalledWith({ where: { id: 'other-meeting', ownerId: 'owner' } })
    expect(repo.googleCalendarConnection.findUnique).not.toHaveBeenCalled()
  })
  it('retorna conexão necessária sem criar evento quando Google desconectado', async () => {
    const repo = { meeting: { findFirst: vi.fn().mockResolvedValue({ id: 'm' }), update: vi.fn() }, googleCalendarConnection: { findUnique: vi.fn().mockResolvedValue(null) } }
    expect(await scheduleGoogleMeeting(repo as never, 'owner', 'm', 'request')).toEqual({ kind: 'not-ready', reason: 'GOOGLE_NOT_CONNECTED' })
    expect(repo.meeting.update).not.toHaveBeenCalled()
  })
  it('renova acesso e grava link Meet somente na reunião autenticada', async () => {
    mocks.googleConfig.mockReturnValue({ encryptionKey: 'key' })
    mocks.openToken.mockReturnValue('refresh')
    mocks.exchangeGoogleToken.mockResolvedValue({ access_token: 'access' })
    mocks.createCalendarEvent.mockResolvedValue({ eventId: 'event', link: 'https://meet.google.com/abc-defg-hij', conferenceStatus: 'success' })
    const repo = { meeting: { findFirst: vi.fn().mockResolvedValue({ id: 'm' }), update: vi.fn().mockResolvedValue({ id: 'm', link: 'https://meet.google.com/abc-defg-hij' }) }, googleCalendarConnection: { findUnique: vi.fn().mockResolvedValue({ refreshToken: 'sealed' }) } }
    const result = await scheduleGoogleMeeting(repo as never, 'owner', 'm', 'request')
    expect(result.kind).toBe('scheduled')
    expect(mocks.exchangeGoogleToken).toHaveBeenCalledWith({ encryptionKey: 'key' }, { grant_type: 'refresh_token', refresh_token: 'refresh' })
    expect(repo.meeting.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm', ownerId: 'owner' }, data: { googleEventId: 'event', link: 'https://meet.google.com/abc-defg-hij' } }))
  })
})
