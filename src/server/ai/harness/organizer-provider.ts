import { z } from 'zod'
import type { HarnessOrganizerProvider, OrganizerInput, OrganizerOutput } from './organizer'
import { readHarnessV2Config } from './config'

const DEFAULT_MODEL = 'deepseek-chat'
const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const organizerOutputSchema = z.object({
  markdown: z.string().min(1),
  summary: z.string().optional(),
  topics: z.array(z.object({ id: z.string().trim().min(1) }).strict()).max(100),
}).strict()

/** Fallback deterministico: organiza visualmente sem resumir nem apagar conteudo. */
export class LosslessOrganizerProvider implements HarnessOrganizerProvider {
  async organize(input: OrganizerInput, signal?: AbortSignal): Promise<OrganizerOutput> {
    return {
      markdown: `# Conteudo organizado\n\n${input.transcript}`,
      topics: [{ id: 'topic-1' }],
    }
  }
}

export class DeepSeekOrganizerProvider implements HarnessOrganizerProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly fetchImpl: typeof fetch
  private readonly maxOutputTokens: number

  constructor(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch; maxOutputTokens?: number }) {
    this.apiKey = options.apiKey
    this.model = options.model ?? DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxOutputTokens = options.maxOutputTokens ?? 8_000
  }

  async organize(input: OrganizerInput, signal?: AbortSignal): Promise<OrganizerOutput> {
    const response = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        max_tokens: this.maxOutputTokens,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: organizerSystemPrompt(input.promptVersion) },
          {
            role: 'user',
            content: JSON.stringify({
              transcript: input.transcript,
              currentDate: input.currentDate,
              timezone: input.timezone,
            }),
          },
        ],
      }),
      signal,
    })

    if (!response.ok) throw new Error(`DeepSeek organizer respondeu ${response.status}.`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek organizer nao devolveu conteudo.')
    return organizerOutputSchema.parse(JSON.parse(stripCodeFence(content)))
  }
}

export function buildOrganizerProvider(environment: Record<string, string | undefined>): HarnessOrganizerProvider {
  const provider = environment.HARNESS_ORGANIZER_PROVIDER?.trim() || environment.LLM_PROVIDER?.trim() || 'lossless'
  if (provider === 'lossless' || provider === 'heuristic') return new LosslessOrganizerProvider()
  if (provider === 'deepseek') {
    const apiKey = environment.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY nao configurada.')
    return new DeepSeekOrganizerProvider({
      apiKey,
      model: environment.DEEPSEEK_MODEL?.trim() || undefined,
      maxOutputTokens: readHarnessV2Config(environment).organizerBudget.reservedOutputTokens,
    })
  }
  throw new Error(`HARNESS_ORGANIZER_PROVIDER invalido: ${provider}.`)
}

function organizerSystemPrompt(version: string): string {
  return [
    `Prompt version: ${version}.`,
    'Transforme a transcricao em Markdown de resumo condensado, editavel e separado por topicos claros.',
    'Escreva uma sintese nova: nao copie a transcricao inteira, nao apenas coloque um titulo nela e nao repita paragrafos palavra por palavra.',
    'Reduza redundancias, hesitacoes, saudacoes e fala sem valor informativo, mantendo nomes, datas, decisoes, acoes, pendencias, incertezas e contexto relevante.',
    'Use secoes Markdown quando houver conteudo: Resumo, Decisoes, Tarefas, Pendencias, Datas e Duvidas. Omita secoes vazias.',
    'O campo markdown deve conter a sintese organizada que o usuario vai revisar; o campo summary deve ser uma frase curta de orientacao.',
    'Nao classifique entidades nem invente fatos.',
    'Nao ha contexto de negocio nem ferramentas disponiveis.',
    'Retorne somente JSON: {markdown, summary?, topics:[{id}]}.',
    'IDs de topico devem ser unicos e estaveis.',
  ].join('\n')
}

function stripCodeFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}
