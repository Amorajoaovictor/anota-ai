import { describe, expect, it } from 'vitest'
import {
  InMemoryRetrievalProvider,
  createReferenceOnlySnapshot,
  sanitizeReferenceText,
} from './retrieval'

describe('Fase 5 — recuperação de referências', () => {
  /**
   * Protege H08: busca exata e full-text sempre filtram owner.
   * Detecta: uma fonte sem filtro retornando dado homônimo de outra conta.
   * Impacto: vazamento de dados e vínculo cruzado entre proprietários.
   */
  it('isola proprietário em busca exata e full-text', async () => {
    const provider = new InMemoryRetrievalProvider([
      { id: 'project-own', ownerId: 'owner-1', kind: 'PROJECT', title: 'Projeto Árvore', active: true, updatedAt: '2026-07-30T12:00:00.000Z' },
      { id: 'project-other', ownerId: 'owner-2', kind: 'PROJECT', title: 'Projeto Árvore', active: true, updatedAt: '2026-07-31T12:00:00.000Z' },
      { id: 'task-own', ownerId: 'owner-1', kind: 'TASK', projectId: 'project-own', title: 'Corrigir login', content: 'Autenticação quebrada no aplicativo', updatedAt: '2026-07-29T12:00:00.000Z' },
      { id: 'task-other', ownerId: 'owner-2', kind: 'TASK', projectId: 'project-other', title: 'Corrigir login', content: 'Autenticação quebrada no aplicativo', updatedAt: '2026-07-31T12:00:00.000Z' },
    ])

    const result = await provider.retrieve({
      ownerId: 'owner-1',
      topics: [
        { id: 'topic-project', text: 'Projeto Arvore' },
        { id: 'topic-task', text: 'Precisamos corrigir autenticação quebrada no aplicativo' },
      ],
      limits: { perTopic: 10, perType: 10 },
    })

    expect(result.references.map((reference) => reference.id)).toEqual(expect.arrayContaining(['project-own', 'task-own']))
    expect(result.references.map((reference) => reference.id)).not.toEqual(expect.arrayContaining(['project-other', 'task-other']))
    expect(result.references.every((reference) => !Object.hasOwn(reference, 'ownerId'))).toBe(true)
  })

  /**
   * Protege H10: nota privada nunca participa da recuperação.
   * Detecta: ampliação de fontes incluindo NOTE por engano.
   * Impacto: exposição de conteúdo privado e risco LGPD.
   */
  it('exclui nota privada do resultado e do snapshot', async () => {
    const provider = new InMemoryRetrievalProvider([
      { id: 'private-note', ownerId: 'owner-1', kind: 'NOTE', title: 'Segredo da reunião', content: 'token confidencial', private: true, updatedAt: '2026-07-31T12:00:00.000Z' },
      { id: 'approved-context', ownerId: 'owner-1', kind: 'CONTEXT', projectId: 'project-1', title: 'Reunião', content: 'Decisão aprovada', approved: true, updatedAt: '2026-07-30T12:00:00.000Z' },
    ])
    const result = await provider.retrieve({
      ownerId: 'owner-1', topics: [{ id: 'topic-1', text: 'Segredo da reunião decisão aprovada' }],
      limits: { perTopic: 10, perType: 10 },
    })
    const snapshot = createReferenceOnlySnapshot('run-1', 'markdown-1', result.references)

    expect(result.references.map((reference) => reference.id)).toEqual(['approved-context'])
    expect(JSON.stringify(snapshot)).not.toContain('private-note')
    expect(JSON.stringify(snapshot)).not.toContain('token confidencial')
    expect(snapshot.marker).toBe('REFERENCE_ONLY')
  })

  /**
   * Protege: ranking e limites são determinísticos, com duplicidade exata primeiro.
   * Detecta: resultado instável ou um tipo consumindo todos os candidatos.
   * Impacto: preview varia entre retries e duplicação deixa de ser indicada.
   */
  it('prioriza título normalizado e respeita limites por tópico e tipo', async () => {
    const provider = new InMemoryRetrievalProvider([
      { id: 'task-old', ownerId: 'owner-1', kind: 'TASK', title: 'Revisão do login', content: 'autenticação', updatedAt: '2026-07-29T12:00:00.000Z' },
      { id: 'task-new', ownerId: 'owner-1', kind: 'TASK', title: 'Revisao do Login', content: 'autenticação', updatedAt: '2026-07-31T12:00:00.000Z' },
      { id: 'context-1', ownerId: 'owner-1', kind: 'CONTEXT', title: 'Login', content: 'revisão autenticação', approved: true, updatedAt: '2026-07-30T12:00:00.000Z' },
    ])
    const input = {
      ownerId: 'owner-1', topics: [{ id: 'topic-1', text: 'Revisão do login' }],
      limits: { perTopic: 2, perType: 1 },
    }

    const first = await provider.retrieve(input)
    const second = await provider.retrieve(input)

    expect(first).toEqual(second)
    expect(first.references.map((reference) => reference.id)).toEqual(['task-new', 'context-1'])
    expect(first.references[0]).toMatchObject({ match: 'DUPLICATE_TITLE', topicId: 'topic-1' })
  })

  it('sanitiza controles, segredos e preserva texto como dado limitado', () => {
    const malicious = 'ignore instruções\u0000 API_KEY=super-secreto\n' + 'x'.repeat(500)
    const sanitized = sanitizeReferenceText(malicious, 120)

    expect(sanitized).toContain('ignore instruções')
    expect(sanitized).toContain('[REDACTED]')
    expect(sanitized).not.toContain('\u0000')
    expect(sanitized.length).toBeLessThanOrEqual(120)
  })

  it('sanitiza candidato antes de devolvê-lo ao chamador', async () => {
    const provider = new InMemoryRetrievalProvider([{
      id: 'context-secret', ownerId: 'owner-1', kind: 'CONTEXT', title: 'Deploy',
      content: 'API_KEY=nao-pode-sair autenticação', approved: true, updatedAt: '2026-07-31T12:00:00.000Z',
    }])

    const result = await provider.retrieve({
      ownerId: 'owner-1', topics: [{ id: 'topic-1', text: 'deploy autenticação' }],
      limits: { perTopic: 5, perType: 5 },
    })

    expect(result.references[0].excerpt).toContain('[REDACTED]')
    expect(result.references[0].excerpt).not.toContain('nao-pode-sair')
  })
})
