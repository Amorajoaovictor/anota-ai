import { describe, expect, it } from 'vitest'
import { deriveMarkdownTopics, topicInputsFromMarkdown } from './topics'

describe('metadados estaveis de topicos do Markdown', () => {
  /**
   * Protege: editar corpo sob mesmo titulo preserva ID do topico.
   * Detecta: autosave renumerando evidencias e UNRESOLVED.
   * Impacto: proposta deixa de apontar para conteudo aprovado correto.
   */
  it('preserva ID ao editar conteudo do mesmo topico', () => {
    const previous = [{ id: 'topic-stable', title: 'Decisoes', order: 0 }]
    const topics = deriveMarkdownTopics('## Decisoes\n\nPublicar sexta.', previous, () => 'new-id')
    expect(topics).toEqual([{ id: 'topic-stable', title: 'Decisoes', order: 0 }])
  })

  /**
   * Protege: dividir cria somente ID novo; unir mantem primeiro ID reconhecido.
   * Detecta: todos os topicos trocados por alteracao estrutural local.
   * Impacto: diff humano e rastreabilidade ficam inutilizaveis.
   */
  it('mantem topico conhecido e cria ID apenas para nova secao', () => {
    let sequence = 0
    const topics = deriveMarkdownTopics(
      '## Decisoes\nPublicar.\n\n## Pendencias\nRevisar.',
      [{ id: 'topic-decision', title: 'Decisoes', order: 0 }],
      () => `topic-new-${++sequence}`,
    )
    expect(topics).toEqual([
      { id: 'topic-decision', title: 'Decisoes', order: 0 },
      { id: 'topic-new-1', title: 'Pendencias', order: 1 },
    ])
  })

  it('cria um topico neutro para Markdown sem titulo', () => {
    expect(deriveMarkdownTopics('Texto solto.', [], () => 'topic-neutral')).toEqual([
      { id: 'topic-neutral', title: 'Conteudo', order: 0 },
    ])
  })

  /**
   * Protege: retrieval recebe trecho de cada topico, nao Markdown inteiro repetido.
   * Detecta: ranking misturando decisoes e pendencias sem relacao.
   * Impacto: projeto/duplicidade incorretos no preview.
   */
  it('associa cada ID ao trecho visivel correspondente', () => {
    const markdown = '## Decisoes\nPublicar sexta.\n\n## Pendencias\nRevisar acesso.'
    const metadata = [
      { id: 'topic-decision', title: 'Decisoes', order: 0 },
      { id: 'topic-pending', title: 'Pendencias', order: 1 },
    ]
    expect(topicInputsFromMarkdown(markdown, metadata)).toEqual([
      { id: 'topic-decision', text: '## Decisoes\nPublicar sexta.' },
      { id: 'topic-pending', text: '## Pendencias\nRevisar acesso.' },
    ])
  })
})
