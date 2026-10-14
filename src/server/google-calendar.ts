import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned'
export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string; encryptionKey: string }
export function googleConfig(): GoogleConfig {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_TOKEN_ENCRYPTION_KEY } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !GOOGLE_TOKEN_ENCRYPTION_KEY) throw new Error('GOOGLE_INTEGRATION_NOT_CONFIGURED')
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI, encryptionKey: GOOGLE_TOKEN_ENCRYPTION_KEY }
}
function key(value: string) {
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY_MUST_BE_32_BYTES')
  return bytes
}
export function sealToken(token: string, encryptionKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(encryptionKey), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.')
}
export function openToken(value: string, encryptionKey: string) {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('GOOGLE_TOKEN_CIPHERTEXT_INVALID')
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(encryptionKey), iv!)
  decipher.setAuthTag(tag!)
  return Buffer.concat([decipher.update(ciphertext!), decipher.final()]).toString('utf8')
}
export function authorizationUrl(config: GoogleConfig, state: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: GOOGLE_SCOPE, access_type: 'offline', prompt: 'consent', state }).toString()
  return url.toString()
}
export class GoogleApiError extends Error {
  constructor(readonly operation: string, readonly status: number, readonly code: string, options?: ErrorOptions) {
    super(`Google Calendar ${operation}: HTTP ${status} (${code})`, options)
    this.name = 'GoogleApiError'
  }
}
export async function googleJson(operation: string, url: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<any> {
  let response: Response
  try { response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) }) }
  catch (cause) { throw new GoogleApiError(operation, 0, 'TRANSPORT_FAILURE', { cause }) }
  let body: any
  try { body = await response.json() }
  catch (cause) { throw new GoogleApiError(operation, response.status, 'INVALID_JSON', { cause }) }
  if (!response.ok) {
    const externalCode = typeof body.error === 'string' ? body.error : body.error?.status ?? body.error?.errors?.[0]?.reason ?? 'HTTP_FAILURE'
    // Codes only: provider messages can contain credentials or event content.
    const code = /^[a-zA-Z0-9_\-.]{1,100}$/.test(externalCode) ? externalCode : 'HTTP_FAILURE'
    throw new GoogleApiError(operation, response.status, code)
  }
  return body
}
export async function exchangeGoogleToken(config: GoogleConfig, values: Record<string, string>) {
  const token = await googleJson('oauth.token', 'https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values }) })
  if (typeof token.access_token !== 'string') throw new GoogleApiError('oauth.token', 200, 'MISSING_ACCESS_TOKEN')
  return token as { access_token: string; refresh_token?: string; scope?: string }
}
export type CalendarMeeting = { id: string; title: string; description?: string; startsAt: Date; endsAt?: Date | null; durationMinutes?: number | null; timezone: string }
export async function createCalendarEvent(accessToken: string, meeting: CalendarMeeting, fetcher: typeof fetch = fetch) {
  const endsAt = meeting.endsAt ?? (meeting.durationMinutes ? new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60_000) : null)
  if (!endsAt) throw new Error('GOOGLE_MEETING_END_REQUIRED')
  if (!Number.isFinite(meeting.startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= meeting.startsAt) throw new Error('GOOGLE_MEETING_TIME_INVALID')
  try { new Intl.DateTimeFormat('en', { timeZone: meeting.timezone }) } catch (cause) { throw new Error('GOOGLE_MEETING_TIMEZONE_INVALID', { cause }) }
  const eventId = createHash('sha256').update(`anota-ai:${meeting.id}`).digest('hex')
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const init = { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  let event: any
  try {
    event = await googleJson('events.insert', `${base}?conferenceDataVersion=1`, { ...init, method: 'POST', body: JSON.stringify({ id: eventId, summary: meeting.title, description: meeting.description ?? '', start: { dateTime: meeting.startsAt.toISOString(), timeZone: meeting.timezone }, end: { dateTime: endsAt.toISOString(), timeZone: meeting.timezone }, conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }) }, fetcher)
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.status !== 409) throw error
    event = await googleJson('events.get', `${base}/${eventId}`, init, fetcher)
  }
  const link = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((point: any) => point.entryPointType === 'video')?.uri ?? null
  return { eventId, link, conferenceStatus: event.conferenceData?.createRequest?.status?.statusCode ?? (link ? 'success' : 'pending') }
}
