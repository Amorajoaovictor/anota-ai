import type { SttInput, SttProvider, SttResult } from './provider'

const DEFAULT_MODEL = 'whisper-large-v3-turbo'
const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'

/**
 * Groq é o STT real (PRD 8.1 — provedor de transcrição substituível, hoje Whisper
 * via Groq). Mesma interface do `HeuristicSttProvider`: quem chama não sabe qual
 * dos dois está ativo.
 */
export class GroqSttProvider implements SttProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly fetchImpl: typeof fetch

  constructor(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch }) {
    this.apiKey = options.apiKey
    this.model = options.model || DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async transcribe(input: SttInput): Promise<SttResult> {
    const form = new FormData()
    form.set('model', this.model)
    form.set('language', 'pt')
    form.set('response_format', 'json')
    form.set('file', new Blob([input.bytes as unknown as BlobPart], { type: input.contentType }), fileName(input.contentType))

    const response = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: input.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Groq respondeu ${response.status}: ${body.slice(0, 300)}`)
    }

    const payload = await response.json() as { text?: string }
    const text = payload.text?.trim()
    if (!text) throw new Error('Groq não devolveu transcrição.')
    return { text }
  }
}

/** A API só usa a extensão pra sacar o formato — o `contentType` já diz a verdade, o nome é só rótulo. */
function fileName(contentType: string): string {
  const extension = contentType.split('/')[1]?.split(';')[0] || 'webm'
  return `audio.${extension}`
}
