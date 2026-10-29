import { aiPlanSchema, orderAiPlanActions } from './plan'
import type { ClassificationInput, ClassificationResult, LlmProvider } from './provider'

const DEFAULT_MODEL = 'deepseek-chat'
const ENDPOINT = 'https://api.deepseek.com/chat/completions'

/** DeepSeek produz plano de ações; modelo nunca recebe acesso ao banco nem executa escrita. */
export class DeepSeekLlmProvider implements LlmProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly fetchImpl: typeof fetch

  constructor(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch }) {
    this.apiKey = options.apiKey
    this.model = options.model || DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const response = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: JSON.stringify(userPayload(input)) },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`DeepSeek respondeu ${response.status}: ${body.slice(0, 300)}`)
    }

    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek não devolveu conteúdo na resposta.')
    return parseAndValidate(content, input)
  }
}

function systemPrompt(): string {
  return [
    'Você é o agente contextual de uma central pessoal de projetos.',
    'Extraia TODOS os fatos independentes. Contexto é saída principal; tarefa é opcional.',
    'Uma entrada pode gerar vários contextos e entidades, inclusive em projetos diferentes.',
    'Nunca crie usuário, pessoa, job, auditoria ou registro interno.',
    'Entidades permitidas: project, context, task, milestone, dependency, alias, module, tag.',
    'Operação permitida nesta versão: create.',
    'Cada ação exige id único, dependsOn, confidence, evidence e data. Confidence é porcentagem inteira de 0 a 100, nunca decimal de 0 a 1.',
    'Referência existente usa {"existingId":"id-real"}; entidade nova usa {"actionId":"id-da-acao"} e inclui esse id em dependsOn.',
    'Categorias de contexto: FACT, DECISION, RULE, VOCABULARY, MEETING.',
    'Reunião mencionada no áudio vira contexto MEETING; não invente lembrete de reunião.',
    'Projeto novo só quando o texto realmente define um projeto novo. Caso contrário use id da lista projects.',
    'Tarefa duplicada não deve ser proposta. Consulte recentTasks.',
    'Responda APENAS JSON no formato {summary, confidence, evidence, actions}; confidence do plano também é porcentagem inteira de 0 a 100.',
    'Responda em português do Brasil. Não invente evidências.',
  ].join('\n')
}

function userPayload(input: ClassificationInput) {
  return {
    text: input.text,
    projects: input.projects,
    recentTasks: input.tasks.slice(0, 200),
    contexts: input.contexts.slice(0, 500),
  }
}

function parseAndValidate(content: string, input: ClassificationInput): ClassificationResult {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek não devolveu um JSON válido.')
  }

  normalizeModelPlan(raw, input)

  const parsed = aiPlanSchema.safeParse(raw)
  if (!parsed.success) {
    const entities = modelEntities(raw)
    const shapes = modelActionShapes(raw)
    throw new Error(`Resposta do DeepSeek fora do formato esperado: ${parsed.error.issues.map((issue) => issue.message).join('; ')}${entities.length ? `; entities=${entities.join(',')}` : ''}${shapes.length ? `; shapes=${shapes.join('|')}` : ''}`)
  }

  validateExistingReferences(parsed.data, input)
  orderAiPlanActions(parsed.data)
  return parsed.data
}

/**
 * JSON mode garante JSON, não aderência perfeita ao schema. DeepSeek costuma
 * singularizar arrays e chamar fatos de `decision`/`rule`/`vocabulary`. Esses
 * formatos têm semântica inequívoca e são normalizados antes da validação rígida.
 */
function normalizeModelPlan(raw: unknown, input: ClassificationInput) {
  if (!raw || typeof raw !== 'object') return
  const plan = raw as Record<string, unknown>
  plan.evidence = stringArray(plan.evidence)
  if (!Array.isArray(plan.actions)) return
  const derivedContexts: Record<string, unknown>[] = []

  plan.actions.forEach((value) => {
    if (!value || typeof value !== 'object') return
    const action = value as Record<string, unknown>
    if (!action.data || typeof action.data !== 'object') action.data = {}
    const data = action.data as Record<string, unknown>
    const typeValue = String(action.type ?? '')
    const operationValue = String(action.operation ?? '')
    const discriminator = action.entity
      ?? action.entityType
      ?? action.target
      ?? (normalizeText(typeValue) !== 'create' ? action.type : undefined)
      ?? (normalizeText(operationValue) !== 'create' ? action.operation : undefined)
      ?? data.entity
      ?? data.entityType
      ?? data.type
      ?? inferEntityFromData(data)
    const semantic = normalizeEntity(String(discriminator ?? ''))
    if (semantic.contextCategory) {
      action.entity = 'context'
    } else if (semantic.entity) {
      action.entity = semantic.entity
    }
    action.operation = 'create'
    delete action.type
    delete action.entityType
    delete action.target
    action.dependsOn = stringArray(action.dependsOn)
    action.evidence = stringArray(action.evidence)

    delete data.entity
    delete data.entityType
    delete data.type
    if (semantic.contextCategory) data.category = data.category || semantic.contextCategory
    if (data.category) data.category = normalizeCategory(String(data.category))
    if ('projectId' in data && !('project' in data)) data.project = data.projectId
    delete data.projectId
    if ('project' in data) data.project = normalizeProjectRef(data.project, input)
    if ('tags' in data) data.tags = stringArray(data.tags)
    if (action.entity === 'task' && Array.isArray(data.contexts)) {
      data.contexts.forEach((context, index) => {
        const contextData = normalizeNestedContext(context)
        if (!contextData) return
        derivedContexts.push({
          id: `${String(action.id)}-context-${index + 1}`,
          entity: 'context',
          operation: 'create',
          dependsOn: [...new Set([...(action.dependsOn as string[]), String(action.id)])],
          confidence: action.confidence,
          evidence: action.evidence,
          data: { project: data.project, task: { actionId: action.id }, ...contextData },
        })
      })
    }
    delete data.contexts
    if (action.entity === 'context') {
      data.title = data.title || data.name || 'Contexto extraído'
      data.content = data.content || data.description || data.summary
      data.category = data.category || 'FACT'
    }
  })
  plan.actions.push(...derivedContexts)
}

function normalizeNestedContext(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    const content = value.trim()
    return { category: 'FACT', title: content.length > 80 ? `${content.slice(0, 77)}...` : content, content }
  }
  if (!value || typeof value !== 'object') return null
  const context = value as Record<string, unknown>
  const content = String(context.content ?? context.description ?? context.summary ?? '').trim()
  if (!content) return null
  const title = String(context.title ?? context.name ?? (content.length > 80 ? `${content.slice(0, 77)}...` : content)).trim()
  return { category: normalizeCategory(String(context.category ?? context.type ?? 'FACT')), title, content }
}

function inferEntityFromData(data: Record<string, unknown>): string | undefined {
  if ('dependsOnTask' in data || ('task' in data && 'dependsOn' in data)) return 'dependency'
  if ('category' in data || 'content' in data) return 'context'
  if ('targetAt' in data || 'targetDate' in data) return 'milestone'
  if ('value' in data) return 'alias'
  if ('kind' in data || 'priority' in data || 'dueAt' in data || 'forecastAt' in data) return 'task'
  if (!('project' in data) && 'name' in data) return 'project'
  return undefined
}

function stringArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => (item as string).trim())
  if (typeof value !== 'string') return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function normalizeProjectRef(value: unknown, input: ClassificationInput) {
  if (typeof value !== 'string') return value
  const project = input.projects.find((item) => item.id === value || normalizeText(item.name) === normalizeText(value))
  return project ? { existingId: project.id } : value
}

function normalizeEntity(value: string): { entity?: string; contextCategory?: string } {
  const key = normalizeText(value).replace(/[._ -]?create$/, '').replace(/^create[._ -]?/, '')
  const entities: Record<string, string> = {
    project: 'project', projeto: 'project', context: 'context', contexto: 'context', fact: 'context', fato: 'context',
    task: 'task', tarefa: 'task', milestone: 'milestone', marco: 'milestone', dependency: 'dependency', dependencia: 'dependency',
    alias: 'alias', apelido: 'alias', module: 'module', modulo: 'module', tag: 'tag', etiqueta: 'tag',
  }
  const categories: Record<string, string> = {
    decision: 'DECISION', decisao: 'DECISION', rule: 'RULE', regra: 'RULE', vocabulary: 'VOCABULARY', vocabulario: 'VOCABULARY',
    meeting: 'MEETING', reuniao: 'MEETING',
  }
  return categories[key] ? { contextCategory: categories[key] } : { entity: entities[key] }
}

function normalizeCategory(value: string) {
  const key = normalizeText(value)
  return ({ fact: 'FACT', fato: 'FACT', decision: 'DECISION', decisao: 'DECISION', rule: 'RULE', regra: 'RULE', vocabulary: 'VOCABULARY', vocabulario: 'VOCABULARY', meeting: 'MEETING', reuniao: 'MEETING' } as Record<string, string>)[key] ?? value.toUpperCase()
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function modelEntities(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { actions?: unknown }).actions)) return []
  return (raw as { actions: unknown[] }).actions
    .map((action) => action && typeof action === 'object' ? String((action as { entity?: unknown; type?: unknown }).entity ?? (action as { type?: unknown }).type ?? '') : '')
    .filter(Boolean)
    .slice(0, 20)
}

function modelActionShapes(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { actions?: unknown }).actions)) return []
  return (raw as { actions: unknown[] }).actions.slice(0, 10).map((action) => {
    if (!action || typeof action !== 'object') return typeof action
    const record = action as Record<string, unknown>
    const discriminator = ['entity', 'entityType', 'target', 'kind', 'action', 'type', 'operation']
      .filter((key) => key in record)
      .map((key) => `${key}:${String(record[key]).slice(0, 40)}`)
      .join(',')
    const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {}
    const nested = ['entity', 'entityType', 'type', 'kind']
      .filter((key) => key in data)
      .map((key) => `data.${key}:${String(data[key]).slice(0, 40)}`)
      .join(',')
    return `${Object.keys(record).sort().join('+')}[${discriminator}${nested ? `,${nested}` : ''};dataKeys:${Object.keys(data).sort().join('+')}]`
  })
}

function validateExistingReferences(plan: ClassificationResult, input: ClassificationInput) {
  const projectIds = new Set(input.projects.map((project) => project.id))
  const taskIds = new Set(input.tasks.map((task) => task.id))
  const actionIds = new Set(plan.actions.map((action) => action.id))

  const validateRef = (ref: { existingId: string } | { actionId: string }, kind: 'projeto' | 'tarefa') => {
    if ('existingId' in ref) {
      const valid = kind === 'projeto' ? projectIds.has(ref.existingId) : taskIds.has(ref.existingId)
      if (!valid) throw new Error(`DeepSeek sugeriu ${kind} inexistente: "${ref.existingId}".`)
    } else if (!actionIds.has(ref.actionId)) {
      throw new Error(`DeepSeek referenciou ação inexistente: "${ref.actionId}".`)
    }
  }

  for (const action of plan.actions) {
    if ('project' in action.data) validateRef(action.data.project, 'projeto')
    if (action.entity === 'context' && action.data.task) validateRef(action.data.task, 'tarefa')
    if (action.entity === 'dependency') {
      validateRef(action.data.task, 'tarefa')
      validateRef(action.data.dependsOnTask, 'tarefa')
    }
  }
}
