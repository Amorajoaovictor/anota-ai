import { z } from 'zod'

const idSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/, 'Id da ação contém caracteres inválidos.')
const evidenceSchema = z.array(z.string().trim().min(1)).min(1).max(20)
const confidenceSchema = z.coerce.number().min(0).max(100)
  .transform((value) => Math.round(value <= 1 ? value * 100 : value))
const projectRefSchema = z.union([
  z.object({ existingId: z.string().trim().min(1) }).strict(),
  z.object({ actionId: idSchema }).strict(),
])
const taskRefSchema = z.union([
  z.object({ existingId: z.string().trim().min(1) }).strict(),
  z.object({ actionId: idSchema }).strict(),
])

const actionBase = z.object({
  id: idSchema,
  operation: z.literal('create'),
  dependsOn: z.array(idSchema).max(50).default([]),
  confidence: confidenceSchema,
  evidence: evidenceSchema,
})

const projectActionSchema = actionBase.extend({
  entity: z.literal('project'),
  data: z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  }).strict(),
}).strict()

const contextActionSchema = actionBase.extend({
  entity: z.literal('context'),
  data: z.object({
    project: projectRefSchema,
    task: taskRefSchema.optional(),
    category: z.enum(['FACT', 'DECISION', 'RULE', 'VOCABULARY', 'MEETING']),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(20_000),
  }).strict(),
}).strict()

const taskActionSchema = actionBase.extend({
  entity: z.literal('task'),
  data: z.object({
    project: projectRefSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20_000).optional(),
    moduleName: z.string().trim().max(80).optional(),
    kind: z.enum(['TASK', 'BUG', 'IMPROVEMENT', 'FEATURE', 'DECISION', 'EXTERNAL_REQUEST', 'FUTURE_IDEA', 'QUESTION']).optional(),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    complexity: z.number().int().min(1).max(3).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    forecastAt: z.string().datetime().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  }).strict(),
}).strict()

const milestoneActionSchema = actionBase.extend({
  entity: z.literal('milestone'),
  data: z.object({
    project: projectRefSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20_000).optional(),
    targetAt: z.string().datetime(),
    startAt: z.string().datetime().nullable().optional(),
  }).strict(),
}).strict()

const dependencyActionSchema = actionBase.extend({
  entity: z.literal('dependency'),
  data: z.object({ task: taskRefSchema, dependsOnTask: taskRefSchema }).strict(),
}).strict()

const aliasActionSchema = actionBase.extend({
  entity: z.literal('alias'),
  data: z.object({ project: projectRefSchema, value: z.string().trim().min(1).max(200) }).strict(),
}).strict()

const moduleActionSchema = actionBase.extend({
  entity: z.literal('module'),
  data: z.object({ project: projectRefSchema, name: z.string().trim().min(1).max(80) }).strict(),
}).strict()

const tagActionSchema = actionBase.extend({
  entity: z.literal('tag'),
  data: z.object({
    project: projectRefSchema,
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }).strict(),
}).strict()

export const aiPlanActionSchema = z.discriminatedUnion('entity', [
  projectActionSchema,
  contextActionSchema,
  taskActionSchema,
  milestoneActionSchema,
  dependencyActionSchema,
  aliasActionSchema,
  moduleActionSchema,
  tagActionSchema,
])

export const aiPlanSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  confidence: confidenceSchema,
  evidence: evidenceSchema,
  actions: z.array(aiPlanActionSchema).min(1).max(100),
}).strict().superRefine((plan, context) => {
  const seen = new Set<string>()
  const entities = new Map(plan.actions.map((action) => [action.id, action.entity]))
  plan.actions.forEach((action, index) => {
    if (seen.has(action.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['actions', index, 'id'], message: `Id de ação repetido: ${action.id}.` })
    }
    seen.add(action.id)

    const validateActionRef = (ref: { existingId: string } | { actionId: string } | undefined, entity: 'project' | 'task') => {
      if (!ref || !('actionId' in ref)) return
      if (!action.dependsOn.includes(ref.actionId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['actions', index, 'dependsOn'], message: `Referência ${ref.actionId} precisa estar em dependsOn.` })
      }
      const actual = entities.get(ref.actionId)
      if (actual && actual !== entity) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['actions', index, 'data'], message: `Referência ${ref.actionId} precisa apontar para ${entity}.` })
      }
    }
    if ('project' in action.data) validateActionRef(action.data.project, 'project')
    if (action.entity === 'context') validateActionRef(action.data.task, 'task')
    if (action.entity === 'dependency') {
      validateActionRef(action.data.task, 'task')
      validateActionRef(action.data.dependsOnTask, 'task')
    }
  })
})

export type AiPlan = z.infer<typeof aiPlanSchema>
export type AiPlanAction = z.infer<typeof aiPlanActionSchema>

/** Ordenação topológica estável: dependências executam primeiro; empates preservam ordem proposta. */
export function orderAiPlanActions(plan: AiPlan): AiPlanAction[] {
  const byId = new Map(plan.actions.map((action) => [action.id, action]))
  for (const action of plan.actions) {
    for (const dependencyId of action.dependsOn) {
      if (!byId.has(dependencyId)) throw new Error(`Ação ${action.id} possui dependência inexistente: ${dependencyId}.`)
      if (dependencyId === action.id) throw new Error(`Plano contém ciclo na ação ${action.id}.`)
    }
  }

  const ordered: AiPlanAction[] = []
  const remaining = new Set(plan.actions.map((action) => action.id))
  while (remaining.size) {
    const ready = plan.actions.filter((action) => remaining.has(action.id) && action.dependsOn.every((id) => !remaining.has(id)))
    if (!ready.length) throw new Error('Plano contém ciclo entre ações.')
    ready.forEach((action) => {
      ordered.push(action)
      remaining.delete(action.id)
    })
  }
  return ordered
}
