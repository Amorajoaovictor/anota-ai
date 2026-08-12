import { z } from 'zod'

export const HARNESS_PROPOSAL_SCHEMA_VERSION = 1 as const

const localIdSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/)
const textSchema = z.string().trim().min(1)
const dateTimeWithOffsetSchema = z.string().datetime({ offset: true })
const projectRefSchema = z.union([
  z.object({ existingId: textSchema }).strict(),
  z.object({ localId: localIdSchema }).strict(),
])
const taskRefSchema = z.union([
  z.object({ existingId: textSchema }).strict(),
  z.object({ localId: localIdSchema }).strict(),
])
const milestoneRefSchema = z.union([
  z.object({ existingId: textSchema }).strict(),
  z.object({ localId: localIdSchema }).strict(),
])

const evidenceSchema = z.object({
  topicId: localIdSchema,
  quote: textSchema.max(2_000),
}).strict()

const confidenceSchema = z.object({
  type: z.number().min(0).max(100),
  project: z.number().min(0).max(100).optional(),
  dates: z.number().min(0).max(100).optional(),
}).strict()

const itemBaseSchema = z.object({
  id: localIdSchema,
  topicIds: z.array(localIdSchema).min(1).max(100),
  operation: z.enum(['CREATE', 'LINK']),
  dependsOn: z.array(localIdSchema).max(100),
  evidence: z.array(evidenceSchema).min(1).max(100),
  confidence: confidenceSchema,
  duplicateCandidates: z.array(textSchema).max(20),
})

const taskItemSchema = itemBaseSchema.extend({
  entity: z.literal('TASK'),
  data: z.object({
    project: projectRefSchema,
    title: textSchema.max(200),
    description: z.string().max(20_000).optional(),
    moduleName: z.string().trim().max(80).optional(),
    kind: z.enum(['TASK', 'BUG', 'IMPROVEMENT', 'FEATURE', 'DECISION', 'EXTERNAL_REQUEST', 'FUTURE_IDEA', 'QUESTION']).optional(),
    status: z.enum(['BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELED']).optional(),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    complexity: z.number().int().min(1).max(3).nullable().optional(),
    dueAt: dateTimeWithOffsetSchema.nullable().optional(),
    forecastAt: dateTimeWithOffsetSchema.nullable().optional(),
    tags: z.array(textSchema.max(80)).max(20).optional(),
    milestones: z.array(milestoneRefSchema).max(20).optional(),
  }).strict(),
}).strict()

const meetingDataSchema = z.object({
  project: projectRefSchema.optional(),
  title: textSchema.max(200),
  description: z.string().max(20_000).optional(),
  startsAt: dateTimeWithOffsetSchema,
  endsAt: dateTimeWithOffsetSchema.optional(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  timezone: textSchema.max(100),
  link: z.string().url().optional(),
}).strict().superRefine((data, context) => {
  if (!data.endsAt && data.durationMinutes === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'Reunião exige fim ou duração.' })
  }
})

const meetingItemSchema = itemBaseSchema.extend({ entity: z.literal('MEETING'), data: meetingDataSchema }).strict()

const noteItemSchema = itemBaseSchema.extend({
  entity: z.literal('NOTE'),
  data: z.object({
    project: projectRefSchema,
    task: taskRefSchema.optional(),
    title: textSchema.max(200),
    content: textSchema.max(20_000),
    private: z.literal(true),
  }).strict(),
}).strict()

const milestoneItemSchema = itemBaseSchema.extend({
  entity: z.literal('MILESTONE'),
  data: z.object({
    project: projectRefSchema,
    name: textSchema.max(200),
    description: z.string().max(20_000).optional(),
    startAt: dateTimeWithOffsetSchema.nullable().optional(),
    targetAt: dateTimeWithOffsetSchema,
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'POSTPONED', 'CANCELED']).optional(),
    tasks: z.array(taskRefSchema).max(100).optional(),
  }).strict(),
}).strict()

const projectItemSchema = itemBaseSchema.extend({
  entity: z.literal('PROJECT'),
  data: z.object({ name: textSchema.max(200), description: z.string().max(10_000).optional() }).strict(),
}).strict()

const aliasItemSchema = itemBaseSchema.extend({
  entity: z.literal('ALIAS'),
  data: z.object({ project: projectRefSchema, value: textSchema.max(200) }).strict(),
}).strict()

const moduleItemSchema = itemBaseSchema.extend({
  entity: z.literal('MODULE'),
  data: z.object({ project: projectRefSchema, name: textSchema.max(80) }).strict(),
}).strict()

const tagItemSchema = itemBaseSchema.extend({
  entity: z.literal('TAG'),
  data: z.object({ project: projectRefSchema, name: textSchema.max(80) }).strict(),
}).strict()

const contextItemSchema = itemBaseSchema.extend({
  entity: z.literal('CONTEXT'),
  data: z.object({
    project: projectRefSchema,
    task: taskRefSchema.optional(),
    category: z.enum(['FACT', 'DECISION', 'RULE', 'VOCABULARY', 'MEETING']),
    title: textSchema.max(200),
    content: textSchema.max(20_000),
  }).strict(),
}).strict()

const dependencyItemSchema = itemBaseSchema.extend({
  entity: z.literal('DEPENDENCY'),
  data: z.object({ task: taskRefSchema, dependsOnTask: taskRefSchema }).strict(),
}).strict()

const taskMilestoneItemSchema = itemBaseSchema.extend({
  entity: z.literal('TASK_MILESTONE'),
  data: z.object({ task: taskRefSchema, milestone: milestoneRefSchema }).strict(),
}).strict()

export const harnessProposalItemV1Schema = z.discriminatedUnion('entity', [
  taskItemSchema,
  meetingItemSchema,
  noteItemSchema,
  milestoneItemSchema,
  projectItemSchema,
  aliasItemSchema,
  moduleItemSchema,
  tagItemSchema,
  contextItemSchema,
  dependencyItemSchema,
  taskMilestoneItemSchema,
])

const unresolvedSchema = z.object({
  topicId: localIdSchema,
  reason: textSchema.max(2_000),
  evidence: z.array(z.object({ quote: textSchema.max(2_000) }).strict()).min(1).max(20),
}).strict()

export const harnessProposalV1Schema = z.object({
  schemaVersion: z.literal(HARNESS_PROPOSAL_SCHEMA_VERSION),
  summary: textSchema.max(2_000),
  items: z.array(harnessProposalItemV1Schema).max(100),
  unresolved: z.array(unresolvedSchema).max(100),
}).strict().superRefine((proposal, context) => {
  const ids = new Set<string>()
  proposal.items.forEach((item, index) => {
    if (ids.has(item.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'id'], message: `ID local repetido: ${item.id}.` })
    }
    ids.add(item.id)
    for (const evidence of item.evidence) {
      if (!item.topicIds.includes(evidence.topicId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'evidence'], message: `Evidência usa tópico não declarado: ${evidence.topicId}.` })
      }
    }
  })

  const byId = new Map(proposal.items.map((item) => [item.id, item]))
  proposal.items.forEach((item, index) => {
    for (const dependencyId of item.dependsOn) {
      if (!byId.has(dependencyId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'dependsOn'], message: `Dependência local inexistente: ${dependencyId}.` })
      }
    }
  })

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const item = byId.get(id)
    const cycle = item?.dependsOn.some((dependencyId) => byId.has(dependencyId) && hasCycle(dependencyId)) ?? false
    visiting.delete(id)
    visited.add(id)
    return cycle
  }
  if (proposal.items.some((item) => hasCycle(item.id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Proposta contém ciclo entre dependências.' })
  }
})

export type HarnessProposalV1 = z.infer<typeof harnessProposalV1Schema>
