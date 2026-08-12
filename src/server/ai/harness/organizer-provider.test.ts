import { describe, expect, it, vi } from 'vitest'
import { DeepSeekOrganizerProvider, LosslessOrganizerProvider } from './organizer-provider'

const input = {
  transcript: 'Decisao: publicar sexta. Duvida: horario ainda incerto.',
  currentDate: '2026-07-31',
  timezone: 'America/Sao_Paulo',
  promptVersion: 'organizer-v1',
}

describe('Fase 4 - adapters versionados da LLM 1', () => {
  /**
   * Protege: fallback local mantem cada caractere da entrada dentro do Markdown.
   * Detecta: ambiente sem chave resumindo ou descartando texto.
   * Impacto: fluxo local perde decisao antes da revisao humana.
   */
  it('organizador local preserva transcricao integral', async () => {
    const result = await new LosslessOrganizerProvider().organize(input)

    expect(result.markdown).toContain(input.transcript)
    expect(result.topics).toHaveLength(1)
  })

  /**
   * Protege: DeepSeek recebe apenas contrato minimo e responde JSON validado.
   * Detecta: retorno ao prompt legado com projetos, tasks, contexts ou ferramentas.
   * Impacto: quebra isolamento da primeira chamada e pode expor nota privada.
   */
  it('DeepSeek nao recebe contexto de negocio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        markdown: '# Registro\n\nDecisao: publicar sexta. Duvida: horario ainda incerto.',
        summary: 'Registro organizado.',
        topics: [{ id: 'topic-1' }],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const result = await new DeepSeekOrganizerProvider({ apiKey: 'test-key', fetchImpl }).organize(input)
    const request = fetchImpl.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(request.body))
    const serialized = JSON.stringify(body)

    expect(result.topics).toEqual([{ id: 'topic-1' }])
    expect(serialized).toContain(input.transcript)
    expect(serialized).not.toContain('projects')
    expect(serialized).not.toContain('tasks')
    expect(serialized).not.toContain('contexts')
    expect(body.tools).toBeUndefined()
    expect(body.max_tokens).toBe(8_000)
  })

  /**
   * Protege: Markdown da primeira aprovacao e sintese editavel por topicos.
   * Detecta: prompt pedindo transcricao integral ou proibindo resumo.
   * Impacto: usuario precisa revisar audio inteiro e LLM 2 recebe contexto ruidoso.
   */
  it('instrui resumo estruturado por topicos, nao copia da transcricao', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        markdown: '# Resumo\n\n## Decisoes\n\n- Publicar sexta.',
        summary: 'Publicacao prevista para sexta.',
        topics: [{ id: 'topic-1' }],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await new DeepSeekOrganizerProvider({ apiKey: 'test-key', fetchImpl }).organize(input)
    const request = fetchImpl.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(request.body))

    expect(body.messages[0].content).toContain('Markdown de resumo condensado')
    expect(body.messages[0].content).toContain('topicos')
    expect(body.messages[0].content).not.toContain('Nao resuma')
    expect(body.messages[0].content).toContain('nao copie a transcricao inteira')
    expect(body.thinking).toEqual({ type: 'disabled' })
  })

  /**
   * Protege: resposta fora do contrato nao cria revisao ativa.
   * Detecta: texto livre ou JSON incompleto aceito depois de mudanca do provedor.
   * Impacto: editor recebe artefato impossivel de aprovar com seguranca.
   */
  it('rejeita resposta sem Markdown estruturado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"sem markdown"}' } }],
    }), { status: 200 }))

    await expect(new DeepSeekOrganizerProvider({ apiKey: 'test-key', fetchImpl }).organize(input)).rejects.toThrow()
  })
})
