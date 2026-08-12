import { describe, expect, it, vi } from 'vitest'
import { organizeTranscript, validateOrganizedMarkdown } from './organizer'

const limits = {
  contextWindowTokens: 1_000,
  systemPromptTokens: 100,
  reservedOutputTokens: 200,
  reservedReferenceTokens: 0,
  safetyMarginTokens: 100,
  maxMarkdownCharacters: 5_000,
  countTokens: (content: string) => content.length,
}

describe('Fase 4 - LLM 1 organiza transcricao sem contexto de negocio', () => {
  /**
   * Protege: provedor recebe somente snapshot da transcricao, data, fuso e prompt versionado.
   * Detecta: projetos, notas, tarefas ou revisoes antigas voltando para primeira chamada.
   * Impacto: vazamento de dados privados e organizacao enviesada por contexto nao aprovado.
   */
  it('envia contrato minimo ao provedor e preserva saida completa', async () => {
    const provider = {
      organize: vi.fn().mockResolvedValue({
        markdown: '# Reuniao\n\n- Decidimos corrigir o acesso.\n- Prazo incerto.',
        summary: 'Reuniao com duas informacoes.',
        topics: [{ id: 'topic-1' }, { id: 'topic-2' }],
      }),
    }

    const result = await organizeTranscript({
      transcript: 'Decidimos corrigir o acesso. Prazo incerto.',
      currentDate: '2026-07-31',
      timezone: 'America/Sao_Paulo',
      promptVersion: 'organizer-v1',
    }, limits, provider)

    expect(result.kind).toBe('organized')
    expect(provider.organize).toHaveBeenCalledWith({
      transcript: 'Decidimos corrigir o acesso. Prazo incerto.',
      currentDate: '2026-07-31',
      timezone: 'America/Sao_Paulo',
      promptVersion: 'organizer-v1',
    })
    expect(result).toMatchObject({
      kind: 'organized',
      markdown: expect.stringContaining('Prazo incerto'),
      topicIds: ['topic-1', 'topic-2'],
    })
  })

  /**
   * Protege: entrada acima do orcamento fica intacta e nao chega ao provedor.
   * Detecta: truncamento silencioso para encaixar na janela do modelo.
   * Impacto: decisoes e tarefas desaparecem antes da primeira aprovacao.
   */
  it('retorna INPUT_TOO_LARGE sem cortar nem chamar provedor', async () => {
    const transcript = 'conteudo-integral-que-nao-pode-ser-cortado'
    const provider = { organize: vi.fn() }

    const result = await organizeTranscript({
      transcript,
      currentDate: '2026-07-31',
      timezone: 'America/Sao_Paulo',
      promptVersion: 'organizer-v1',
    }, { ...limits, contextWindowTokens: 10, systemPromptTokens: 2, reservedOutputTokens: 2, safetyMarginTokens: 2 }, provider)

    expect(result).toMatchObject({ kind: 'rejected', code: 'INPUT_TOO_LARGE', original: transcript })
    expect(provider.organize).not.toHaveBeenCalled()
  })

  /**
   * Protege: somente Markdown nao vazio, seguro, limitado e com topicos unicos vira revisao.
   * Detecta: HTML executavel, IDs duplicados ou resposta vazia chegando ao editor.
   * Impacto: XSS, editor inconsistente ou aprovacao sem conteudo confiavel.
   */
  it('rejeita HTML perigoso, topicos repetidos e Markdown grande', () => {
    expect(() => validateOrganizedMarkdown({ markdown: '<script>alert(1)</script>', topics: [] }, 5_000)).toThrow('HTML perigoso')
    expect(() => validateOrganizedMarkdown({ markdown: '# X', topics: [{ id: 'topic-1' }, { id: 'topic-1' }] }, 5_000)).toThrow('IDs de topico repetidos')
    expect(() => validateOrganizedMarkdown({ markdown: '# 123456', topics: [] }, 3)).toThrow('limite')
  })
})
