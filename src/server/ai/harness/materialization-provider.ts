import type {
  MaterializationProvider,
  MaterializationProviderResponse,
  MaterializationRequest,
} from './materialization'
import { readHarnessV2Config } from './config'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

export class DeepSeekMaterializationProvider implements MaterializationProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly maxOutputTokens: number

  constructor(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch; now?: () => number; maxOutputTokens?: number }) {
    this.apiKey = options.apiKey
    this.model = options.model ?? DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? (() => Date.now())
    this.maxOutputTokens = options.maxOutputTokens ?? 8_000
  }

  async generate(request: MaterializationRequest, signal?: AbortSignal): Promise<MaterializationProviderResponse> {
    if (request.tools.length !== 0) throw new Error('Materializer nao permite tools.')
    const startedAt = this.now()
    const response = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        max_tokens: this.maxOutputTokens,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
    })
    if (!response.ok) throw new Error(`DeepSeek materializer respondeu ${response.status}.`)
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    }
    const rawOutput = payload.choices?.[0]?.message?.content
    if (!rawOutput) throw new Error('DeepSeek materializer nao devolveu conteudo.')
    return {
      rawOutput: stripCodeFence(rawOutput),
      provider: 'deepseek',
      model: payload.model ?? this.model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      latencyMs: Math.max(0, this.now() - startedAt),
    }
  }
}

export function buildMaterializationProvider(environment: Record<string, string | undefined>): MaterializationProvider {
  const provider = environment.HARNESS_MATERIALIZER_PROVIDER?.trim() || environment.LLM_PROVIDER?.trim() || 'deepseek'
  if (provider !== 'deepseek') throw new Error(`HARNESS_MATERIALIZER_PROVIDER invalido: ${provider}. Use "deepseek".`)
  const apiKey = environment.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY nao configurada.')
  return new DeepSeekMaterializationProvider({
    apiKey,
    model: environment.DEEPSEEK_MODEL?.trim() || undefined,
    maxOutputTokens: readHarnessV2Config(environment).materializerBudget.reservedOutputTokens,
  })
}

function stripCodeFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}
