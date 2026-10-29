import { describe, expect, it, vi } from 'vitest'
import { getHarnessReadModel, permissionsFor } from './read-model'

describe('APIs v2 - leitura persistida do harness', () => {
  /**
   * Protege: consulta de run sempre combina inbox e owner no servidor.
   * Detecta: acesso cruzado por ID adivinhado ou reload sem filtro de proprietario.
   * Impacto: vazamento de transcricao, Markdown e proposta entre contas.
   */
  it('filtra dono e devolve revisoes ativas com permissoes do estado', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'run-1', ownerId: 'owner-1', inboxItemId: 'inbox-1', status: 'AWAITING_MARKDOWN_APPROVAL', version: 3,
      failedStep: null, errorCode: null, retryable: false, discardedAt: null, processedAt: null,
      activeTranscriptId: 'transcript-1', activeMarkdownRevisionId: 'markdown-2', activeProposalRevisionId: null,
      inboxItem: { id: 'inbox-1', source: 'TEXT', text: 'Texto original' },
      transcripts: [{ id: 'transcript-1', version: 1, text: 'Texto original', contentHash: 't-hash' }],
      markdownRevisions: [{ id: 'markdown-2', version: 2, content: '# Editado', contentHash: 'm-hash', source: 'USER' }],
      proposalRevisions: [], approvals: [], executions: [], jobs: [],
    })
    const repository: any = { aiRun: { findFirst } }

    const result = await getHarnessReadModel(repository, 'owner-1', 'inbox-1')

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { inboxItemId: 'inbox-1', ownerId: 'owner-1' } }))
    expect(result).toMatchObject({
      kind: 'found',
      harness: {
        id: 'run-1', status: 'AWAITING_MARKDOWN_APPROVAL', version: 3,
        transcript: { id: 'transcript-1', text: 'Texto original' },
        markdown: { id: 'markdown-2', content: '# Editado' },
        proposal: null,
        permissions: { editMarkdown: true, approveMarkdown: true, editProposal: false, execute: false, retry: false, discard: true },
      },
    })
  })

  /**
   * Protege: ausencia ou recurso de outro dono usa mesmo resultado opaco.
   * Detecta: API revelando que inbox existe para outra conta.
   * Impacto: enumeracao de dados e metadados sensiveis.
   */
  it('retorna not-found sem modelo parcial', async () => {
    const repository: any = { aiRun: { findFirst: vi.fn().mockResolvedValue(null) } }
    expect(await getHarnessReadModel(repository, 'owner-2', 'inbox-1')).toEqual({ kind: 'not-found' })
  })

  it('habilita apenas preview e execucao na segunda aprovacao', async () => {
    const repository: any = { aiRun: { findFirst: vi.fn().mockResolvedValue({
      id: 'run-1', ownerId: 'owner-1', inboxItemId: 'inbox-1', status: 'AWAITING_ENTITY_APPROVAL', version: 8,
      failedStep: null, errorCode: null, retryable: false, discardedAt: null, processedAt: null,
      activeTranscriptId: 'transcript-1', activeMarkdownRevisionId: 'markdown-2', activeProposalRevisionId: 'proposal-1',
      inboxItem: { id: 'inbox-1', source: 'TEXT', text: 'Original' },
      transcripts: [{ id: 'transcript-1', text: 'Original' }],
      markdownRevisions: [{ id: 'markdown-2', content: '# Aprovado' }],
      proposalRevisions: [{ id: 'proposal-1', validatedPlan: { schemaVersion: 1, summary: 'x', items: [], unresolved: [] }, items: [] }],
      approvals: [{ type: 'MARKDOWN', targetId: 'markdown-2', targetHash: 'm-hash' }], executions: [], jobs: [],
    }) } }

    const result = await getHarnessReadModel(repository, 'owner-1', 'inbox-1')
    expect(result).toMatchObject({ kind: 'found', harness: { permissions: {
      editMarkdown: true, approveMarkdown: false, editProposal: true, execute: true, retry: false, discard: true,
    } } })
  })

  /**
   * Protege: Markdown aprovado continua corrigível antes do começo da execução atômica.
   * Detecta: UI sem caminho seguro para invalidar uma proposta derivada de texto incorreto.
   * Impacto: usuário fica obrigado a executar conteúdo errado ou descartar toda a entrada.
   */
  it('permite voltar ao Markdown enquanto nenhum executor começou', () => {
    expect(permissionsFor('RETRIEVING_REFERENCES', false).editMarkdown).toBe(true)
    expect(permissionsFor('MATERIALIZING', false).editMarkdown).toBe(true)
    expect(permissionsFor('AWAITING_ENTITY_APPROVAL', false).editMarkdown).toBe(true)
    expect(permissionsFor('EXECUTING', false).editMarkdown).toBe(false)
  })
})
