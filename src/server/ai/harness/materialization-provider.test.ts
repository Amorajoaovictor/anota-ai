import { describe, expect, it, vi } from 'vitest'
import { DeepSeekMaterializationProvider } from './materialization-provider'

const request = {
  system: 'Somente Markdown aprovado.',
  user: '{"approvedMarkdown":"# Tarefa"}',
  responseFormat: 'json_schema' as const,
  tools: [] as const,
}

describe('adapter DeepSeek da LLM 2', () => {
  /**
   * Protege: segunda chamada usa request construido pelo harness, JSON e zero tools.
   * Detecta: provider reintroduzindo transcricao ou classificador single-shot.
   * Impacto: conteudo removido reaparece ou modelo ganha escrita direta.
   */
  it('devolve rawOutput e metricas tecnicas sem alterar payload', async () => {
    const rawOutput = '{"schemaVersion":1,"summary":"x","items":[],"unresolved":[]}'
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: rawOutput } }],
      usage: { prompt_tokens: 120, completion_tokens: 30 },
      model: 'deepseek-chat',
    }), { status: 200 }))
    const provider = new DeepSeekMaterializationProvider({ apiKey: 'test-key', fetchImpl, now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(160) })
    const controller = new AbortController()

    const result = await provider.generate(request, controller.signal)
    const requestInit = fetchImpl.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(requestInit.body))

    expect(result).toEqual({ rawOutput, provider: 'deepseek', model: 'deepseek-chat', inputTokens: 120, outputTokens: 30, latencyMs: 60 })
    expect(body.messages).toEqual([{ role: 'system', content: request.system }, { role: 'user', content: request.user }])
    expect(body.tools).toBeUndefined()
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.max_tokens).toBe(8_000)
    expect(requestInit.signal).toBe(controller.signal)
  })

  /**
   * Protege: erro publico nao carrega corpo bruto do provedor.
   * Detecta: prompt/resposta sensivel entrando em log por excecao.
   * Impacto: exposicao LGPD e segredo em observabilidade.
   */
  it('falha com status sanitizado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('conteudo-sensivel', { status: 503 }))
    await expect(new DeepSeekMaterializationProvider({ apiKey: 'test-key', fetchImpl }).generate(request))
      .rejects.toThrow('DeepSeek materializer respondeu 503.')
  })
})
