import { describe, expect, it, vi } from 'vitest'
import { GroqSttProvider } from './groq'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

describe('GroqSttProvider', () => {
  it('envia o áudio como multipart com modelo e idioma pt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: 'texto transcrito' }))
    const provider = new GroqSttProvider({ apiKey: 'gsk-teste', fetchImpl })

    const result = await provider.transcribe({ bytes: new Uint8Array([1, 2, 3]), contentType: 'audio/webm' })

    expect(result).toEqual({ text: 'texto transcrito' })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.groq.com/openai/v1/audio/transcriptions', expect.objectContaining({
      method: 'POST',
      headers: { authorization: 'Bearer gsk-teste' },
    }))
    const form = (fetchImpl.mock.calls[0]![1] as RequestInit).body as FormData
    expect(form.get('model')).toBe('whisper-large-v3-turbo')
    expect(form.get('language')).toBe('pt')
    expect((form.get('file') as File).name).toBe('audio.webm')
  })

  it('usa o modelo customizado quando informado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: 'ok' }))
    const provider = new GroqSttProvider({ apiKey: 'gsk-teste', model: 'whisper-large-v3', fetchImpl })

    await provider.transcribe({ bytes: new Uint8Array([1]), contentType: 'audio/mp4' })

    const form = (fetchImpl.mock.calls[0]![1] as RequestInit).body as FormData
    expect(form.get('model')).toBe('whisper-large-v3')
    expect((form.get('file') as File).name).toBe('audio.mp4')
  })

  it('propaga erro com status quando a API falha', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid file' }, 400))
    const provider = new GroqSttProvider({ apiKey: 'gsk-teste', fetchImpl })

    await expect(provider.transcribe({ bytes: new Uint8Array([1]), contentType: 'audio/webm' })).rejects.toThrow('400')
  })

  it('recusa transcrição vazia', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: '   ' }))
    const provider = new GroqSttProvider({ apiKey: 'gsk-teste', fetchImpl })

    await expect(provider.transcribe({ bytes: new Uint8Array([1]), contentType: 'audio/webm' })).rejects.toThrow('não devolveu transcrição')
  })
  /**
   * H14 protege: cancelamento do worker chega ao fetch do provedor.
   * Detecta: adapter ignorando AbortSignal recebido do runner.
   * Impacto: request continua consumindo tempo e credito depois do timeout/descarte.
   */
  it('repassa AbortSignal para o fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: 'ok' }))
    const provider = new GroqSttProvider({ apiKey: 'gsk-teste', fetchImpl })
    const controller = new AbortController()

    await provider.transcribe({ bytes: new Uint8Array([1]), contentType: 'audio/webm', signal: controller.signal })

    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }))
  })
})
