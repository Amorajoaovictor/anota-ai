import type { PrismaClient } from '@prisma/client'
import { createCalendarEvent, exchangeGoogleToken, googleConfig, openToken } from './google-calendar'

export async function scheduleGoogleMeeting(repository: Pick<PrismaClient, 'meeting' | 'googleCalendarConnection'>, ownerId: string, meetingId: string, requestId: string) {
  const meeting = await repository.meeting.findFirst({ where: { id: meetingId, ownerId } })
  if (!meeting) return { kind: 'not-found' as const }
  const connection = await repository.googleCalendarConnection.findUnique({ where: { ownerId } })
  if (!connection) return { kind: 'not-ready' as const, reason: 'GOOGLE_NOT_CONNECTED' }
  try {
    const config = googleConfig()
    const refreshToken = openToken(connection.refreshToken, config.encryptionKey)
    const token = await exchangeGoogleToken(config, { grant_type: 'refresh_token', refresh_token: refreshToken })
    const event = await createCalendarEvent(token.access_token, meeting)
    if (event.conferenceStatus === 'failure') throw new Error('GOOGLE_MEET_CONFERENCE_FAILED')
    const updated = await repository.meeting.update({ where: { id: meetingId, ownerId }, data: { googleEventId: event.eventId, ...(event.link ? { link: event.link } : {}) }, include: { project: { select: { name: true, color: true } } } })
    return { kind: 'scheduled' as const, meeting: updated, conferenceStatus: event.conferenceStatus }
  } catch (error) {
    console.error(JSON.stringify({ event: 'google.calendar.schedule_failed', service: 'google-calendar', operation: 'schedule-meeting', requestId, ownerId, meetingId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } : undefined, ...('status' in error ? { status: error.status } : {}), ...('code' in error ? { code: error.code } : {}) } : { name: 'NonError' } }))
    throw error
  }
}
