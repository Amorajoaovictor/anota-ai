import { describe, expect, it, vi } from 'vitest'
import { sealToken, openToken, authorizationUrl, createCalendarEvent } from './google-calendar'

const config = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.example/api/integrations/google/callback', encryptionKey: Buffer.alloc(32, 7).toString('base64') }
describe('Google Calendar e Meet', () => {
  it('protege refresh token contra leitura e adulteração', () => {
    const sealed = sealToken('refresh-secret', config.encryptionKey)
    expect(sealed).not.toContain('refresh-secret')
    expect(openToken(sealed, config.encryptionKey)).toBe('refresh-secret')
    expect(() => openToken(sealed, Buffer.alloc(32, 8).toString('base64'))).toThrow()
  })
  it('solicita acesso offline limitado aos eventos com estado anti-CSRF', () => {
    const url = new URL(authorizationUrl(config, 'unique-state'))
    expect(url.searchParams.get('state')).toBe('unique-state')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events.owned')
  })
  it('usa ID estável e pede Meet para evitar evento duplicado em retry', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 'event', hangoutLink: 'https://meet.google.com/abc-defg-hij' })))
    const meeting = { id: 'meeting-1', title: 'Alinhamento', description: '', startsAt: new Date('2030-01-01T13:00:00Z'), endsAt: new Date('2030-01-01T14:00:00Z'), timezone: 'America/Sao_Paulo' }
    const first = await createCalendarEvent('access', meeting, fetcher)
    await createCalendarEvent('access', meeting, fetcher)
    expect(first.link).toBe('https://meet.google.com/abc-defg-hij')
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toContain('conferenceDataVersion=1')
    const body = JSON.parse(init.body)
    expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet')
    expect(body.id).toBe(JSON.parse(fetcher.mock.calls[1]![1].body).id)
    expect(body.start.timeZone).toBe('America/Sao_Paulo')
  })
  it('rejeita duração ausente antes de chamar serviço externo', async () => {
    const fetcher = vi.fn()
    await expect(createCalendarEvent('access', { id: 'm', title: 'Reunião', startsAt: new Date(), timezone: 'America/Sao_Paulo' }, fetcher)).rejects.toThrow('GOOGLE_MEETING_END_REQUIRED')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('preserva status e código externos sem guardar tokens no erro', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 403, status: 'PERMISSION_DENIED' } }), { status: 403 }))
    await expect(createCalendarEvent('private-token', { id: 'm', title: 'Reunião', startsAt: new Date('2030-01-01T13:00:00Z'), durationMinutes: 30, timezone: 'UTC' }, fetcher)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED', operation: 'events.insert' })
  })
})


describe('recuperação após evento já criado', () => {
  it('recupera evento Google existente após conflito em retry e devolve mesmo Meet', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 409, status: 'ALREADY_EXISTS' } }), { status: 409 })).mockResolvedValueOnce(new Response(JSON.stringify({ hangoutLink: 'https://meet.google.com/abc-defg-hij' })))
    const result = await createCalendarEvent('access', { id: 'm', title: 'Reunião', startsAt: new Date('2030-01-01T13:00:00Z'), durationMinutes: 30, timezone: 'UTC' }, fetcher)
    expect(result.link).toBe('https://meet.google.com/abc-defg-hij')
    expect(fetcher.mock.calls[1]![0]).toMatch(/events\/[a-f0-9]{64}$/)
    expect(fetcher.mock.calls[1]![1].method).toBeUndefined()
  })
})
