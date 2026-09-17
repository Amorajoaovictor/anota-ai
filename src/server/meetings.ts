import { z } from 'zod'

const dateSchema = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Data inválida.')
const titleSchema = z.string().trim().min(1, 'Título da reunião é obrigatório.').max(200)
const descriptionSchema = z.string().trim().max(10_000).optional().default('')
const timezoneSchema = z.string().trim().min(1, 'Fuso horário é obrigatório.').max(100)
const projectIdSchema = z.string().trim().min(1).nullable().optional()

const meetingFields = z.object({
  projectId: projectIdSchema,
  title: titleSchema,
  description: descriptionSchema,
  startsAt: dateSchema,
  endsAt: dateSchema.nullable().optional(),
  durationMinutes: z.number().int().positive().max(1_440).nullable().optional(),
  timezone: timezoneSchema,
  link: z.string().trim().url('Link da reunião inválido.').max(2_000).nullable().optional(),
}).strict()

export const meetingInputSchema = meetingFields.superRefine((value, context) => {
  if (value.endsAt && value.endsAt <= value.startsAt) context.addIssue({ code: 'custom', message: 'Fim da reunião precisa ser posterior ao início.', path: ['endsAt'] })
})

export const meetingPatchSchema = meetingFields.partial().strict()

const meetingInclude = { project: { select: { name: true, color: true } } } as const

type MeetingListRepository = { meeting: { findMany(args: any): Promise<unknown> } }
type MeetingCreateRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  meeting: { create(args: any): Promise<unknown> }
}
type MeetingUpdateRepository = {
  project: { findFirst(args: any): Promise<{ id: string } | null> }
  meeting: {
    findFirst(args: any): Promise<{ id: string; projectId: string | null; startsAt: Date } | null>
    update(args: any): Promise<unknown>
    delete(args: any): Promise<unknown>
  }
}

export async function listMeetings(repository: MeetingListRepository, ownerId: string) {
  return repository.meeting.findMany({
    where: { ownerId },
    orderBy: { startsAt: 'asc' },
    include: meetingInclude,
  })
}

export type CreateMeetingResult =
  | { kind: 'created'; meeting: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'project-not-found' }

export async function createMeeting(repository: MeetingCreateRepository, ownerId: string, input: unknown): Promise<CreateMeetingResult> {
  const parsed = meetingInputSchema.safeParse(input)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }

  const projectId = await ownedProjectId(repository, ownerId, parsed.data.projectId)
  if (parsed.data.projectId && !projectId) return { kind: 'project-not-found' }
  const meeting = await repository.meeting.create({
    data: { ownerId, ...parsed.data, projectId: projectId ?? null },
    include: meetingInclude,
  })
  return { kind: 'created', meeting }
}

export type UpdateMeetingResult =
  | { kind: 'updated'; meeting: unknown }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'not-found' }
  | { kind: 'project-not-found' }

export async function updateMeeting(repository: MeetingUpdateRepository, ownerId: string, meetingId: string, input: unknown): Promise<UpdateMeetingResult> {
  const parsed = meetingPatchSchema.safeParse(input)
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) }

  const meeting = await repository.meeting.findFirst({ where: { id: meetingId, ownerId }, select: { id: true, projectId: true, startsAt: true } })
  if (!meeting) return { kind: 'not-found' }
  const startsAt = parsed.data.startsAt ?? meeting.startsAt
  if (parsed.data.endsAt && parsed.data.endsAt <= startsAt) return { kind: 'invalid', issues: ['Fim da reunião precisa ser posterior ao início.'] }

  const projectId = await ownedProjectId(repository, ownerId, parsed.data.projectId)
  if (parsed.data.projectId && !projectId) return { kind: 'project-not-found' }
  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.projectId !== undefined) data.projectId = projectId ?? null
  const updated = await repository.meeting.update({ where: { id: meetingId }, data, include: meetingInclude })
  return { kind: 'updated', meeting: updated }
}

export async function removeMeeting(repository: MeetingUpdateRepository, ownerId: string, meetingId: string) {
  const meeting = await repository.meeting.findFirst({ where: { id: meetingId, ownerId }, select: { id: true, projectId: true, startsAt: true } })
  if (!meeting) return { kind: 'not-found' as const }
  await repository.meeting.delete({ where: { id: meetingId } })
  return { kind: 'removed' as const }
}

async function ownedProjectId(repository: { project: { findFirst(args: any): Promise<{ id: string } | null> } }, ownerId: string, projectId: string | null | undefined) {
  if (!projectId) return null
  const project = await repository.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } })
  return project?.id ?? null
}
