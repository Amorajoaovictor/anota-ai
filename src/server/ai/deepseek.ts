import { z } from 'zod'
import { complexities, entryKinds, priorities, type Complexity, type EntryKind, type Priority } from '../../domain'
import type { ClassificationInput, ClassificationResult, LlmProvider } from './provider'

const DEFAULT_MODEL = 'deepseek-chat'
const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const responseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1),
  project: z.string().trim().min(1),
  module: z.string().trim().min(1),
  kind: z.enum(entryKinds as [EntryKind, ...EntryKind[]]),
  priority: z.enum(priorities as [Priority, ...Priority[]]),
  complexity: z.enum(complexities as [Complexity, ...Complexity[]]),
  confidence: z.number().min(0).max(100),
  evidence: z.array(z.string().trim().min(1)).min(1),
  duplicates: z.array(z.string().trim().min(1)).default([]),
  action: z.string().trim().min(1),
  due: z.string().trim().min(1).optional().nullable(),
  forecast: z.string().trim().min(1).optional().nullable(),
  responsible: z.string().trim().min(1).optional().nullable(),
  newTags: z.array(z.string().trim().min(1)).optional(),
})

/**
 * DeepSeek é o LLM real do agente contextual (PRD 25.4 — modelo substituível).
 * Estrutura idêntica ao `HeuristicLlmProvider`: mesma entrada, mesma saída
 * (`ContextSuggestion`), então trocar um pelo outro em `config.ts` não muda
 * nenhum chamador. Toda resposta passa por schema antes de virar proposta —
 * PRD 6.2/24: "IA criar informações inexistentes" é mitigado aqui, não confiando
 * cegamente no texto que volta do modelo.
 */
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
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
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
    'Você é o agente contextual de uma central de projetos pessoal (PRD interno).',
    'Recebe um texto solto (demanda, bug, decisão, bloqueio, ideia ou pergunta) e o contexto real dos projetos do usuário.',
    'Responda APENAS com um JSON válido, sem texto fora do JSON, no formato:',
    '{"title": string, "summary": string, "project": string, "module": string,',
    `"kind": um de ${JSON.stringify(entryKinds)},`,
    `"priority": um de ${JSON.stringify(priorities)},`,
    `"complexity": um de ${JSON.stringify(complexities)},`,
    '"confidence": número inteiro 0-100, "evidence": array de strings curtas explicando a escolha,',
    '"duplicates": array de títulos de tarefas existentes que parecem a mesma demanda (só da lista fornecida),',
    '"action": próxima ação concreta, "due": opcional "DD/MM", "forecast": opcional "DD/MM",',
    '"responsible": opcional, "newTags": opcional array de etiquetas novas relevantes.',
    '"project" TEM que ser exatamente um dos nomes em "projects" recebidos — nunca invente projeto novo.',
    'Evidências devem citar o que realmente apareceu no texto ou no contexto do projeto (alias, módulo, etiqueta), nunca inventadas.',
    'Responda em português do Brasil.',
  ].join('\n')
}

function userPayload(input: ClassificationInput) {
  return {
    text: input.text,
    projects: input.projects,
    recentTasks: input.tasks.slice(0, 200),
  }
}

/**
 * O modelo segue "campo opcional" preenchendo com "" em vez de omitir — normaliza
 * antes do schema pra não derrubar uma resposta boa por causa de um `due: ""`.
 */
function normalizeRaw(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const record = raw as Record<string, unknown>
  for (const key of ['due', 'forecast', 'responsible']) {
    if (record[key] === '') record[key] = undefined
  }
  for (const key of ['evidence', 'duplicates', 'newTags']) {
    if (Array.isArray(record[key])) {
      record[key] = (record[key] as unknown[]).filter((value) => typeof value === 'string' && value.trim())
    }
  }
  if ('confidence' in record) {
    const value = Number(record.confidence)
    record.confidence = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
  }
}

function parseAndValidate(content: string, input: ClassificationInput): ClassificationResult {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek não devolveu um JSON válido.')
  }

  normalizeRaw(raw)

  const parsed = responseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Resposta do DeepSeek fora do formato esperado: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  }

  const validProjectNames = new Set(input.projects.map((project) => project.name))
  if (!validProjectNames.has(parsed.data.project)) {
    throw new Error(`DeepSeek sugeriu um projeto inexistente: "${parsed.data.project}".`)
  }

  const knownTitles = new Set(input.tasks.map((task) => task.title.trim().toLocaleLowerCase()))
  const duplicates = parsed.data.duplicates.filter((title) => knownTitles.has(title.trim().toLocaleLowerCase()))

  return {
    ...parsed.data,
    due: parsed.data.due ?? undefined,
    forecast: parsed.data.forecast ?? undefined,
    responsible: parsed.data.responsible ?? undefined,
    duplicates,
  }
}
