import { describe, expect, it } from 'vitest'
import { phase0Fixtures } from './fixtures/phase0'
import { assessHarnessInput } from './budget'
import {
  HARNESS_PROPOSAL_SCHEMA_VERSION,
  harnessProposalV1Schema,
  type HarnessProposalV1,
} from './contracts'
import { sha256 } from './hash'
import { buildMaterializationInput, canExecuteApprovedProposal } from './snapshots'

const approvalFixture = (content: string) => ({
  type: 'MARKDOWN' as const,
  targetId: 'markdown-user-2',
  targetHash: sha256(content),
})

describe('Fase 0 — contratos de aceitação do harness v2', () => {
  /**
   * Protege: nenhuma entidade pode ser executada antes das duas aprovações exatas.
   * Detecta: rota ou job liberando executor só por existir uma proposta.
   * Impacto: usuário perde controle e banco recebe ações não aprovadas.
   */
  it('H01 bloqueia execução até Markdown e proposta exata estarem aprovados', () => {
    const readiness = {
      status: 'AWAITING_ENTITY_APPROVAL' as const,
      markdownRevision: { id: 'markdown-user-2', contentHash: 'markdown-hash' },
      proposalRevision: { id: 'proposal-ai-1', contentHash: 'proposal-hash' },
    }

    expect(canExecuteApprovedProposal({ ...readiness, approvals: [] })).toBe(false)
    expect(canExecuteApprovedProposal({
      ...readiness,
      approvals: [{ type: 'MARKDOWN', targetId: 'markdown-user-2', targetHash: 'markdown-hash' }],
    })).toBe(false)
    expect(canExecuteApprovedProposal({
      ...readiness,
      approvals: [
        { type: 'MARKDOWN', targetId: 'markdown-user-2', targetHash: 'markdown-hash' },
        { type: 'ENTITIES', targetId: 'proposal-ai-1', targetHash: 'proposal-hash' },
      ],
    })).toBe(true)
  })

  /**
   * Protege: LLM 2 recebe somente snapshot de Markdown aprovado.
   * Detecta: transcrição ou revisão gerada reaparecendo depois de remoção manual.
   * Impacto: conteúdo rejeitado pode virar entidade real.
   */
  it('H02 texto removido não reaparece na entrada da materialização', () => {
    const fixture = phase0Fixtures.editedMarkdown
    const input = buildMaterializationInput({
      approvedMarkdownRevision: {
        id: 'markdown-user-2',
        content: fixture.approved,
        contentHash: sha256(fixture.approved),
      },
      markdownApproval: approvalFixture(fixture.approved),
      retrievalSnapshot: { id: 'retrieval-1', contentHash: 'retrieval-hash', references: [] },
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      now: '2026-07-31T12:00:00-03:00',
      timezone: 'America/Sao_Paulo',
    })

    expect(JSON.stringify(input)).not.toContain('senha antiga')
    expect(JSON.stringify(input)).not.toContain(fixture.transcript)
  })

  /**
   * Protege: edição humana aprovada é fonte autoritativa.
   * Detecta: job usando Markdown gerado em vez da revisão aprovada.
   * Impacto: intenção corrigida pelo usuário é ignorada.
   */
  it('H03 texto adicionado pelo usuário chega à materialização', () => {
    const fixture = phase0Fixtures.editedMarkdown
    const input = buildMaterializationInput({
      approvedMarkdownRevision: {
        id: 'markdown-user-2',
        content: fixture.approved,
        contentHash: sha256(fixture.approved),
      },
      markdownApproval: approvalFixture(fixture.approved),
      retrievalSnapshot: { id: 'retrieval-1', contentHash: 'retrieval-hash', references: [] },
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      now: '2026-07-31T12:00:00-03:00',
      timezone: 'America/Sao_Paulo',
    })

    expect(input.approvedMarkdown).toContain('Validar números com a equipe financeira.')
  })

  /**
   * Protege: um tópico pode materializar reunião e tarefas relacionadas.
   * Detecta: contrato impondo uma entidade por tópico.
   * Impacto: ata aprovada vira plano incompleto.
   */
  it('H04 aceita várias entidades sustentadas pelo mesmo tópico', () => {
    const proposal: HarnessProposalV1 = {
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      summary: 'Reunião e pendências do Projeto Aurora.',
      items: [
        {
          id: 'meeting-1', topicIds: ['topic-meeting'], operation: 'CREATE', entity: 'MEETING', dependsOn: [],
          data: {
            title: 'Reunião de acompanhamento',
            startsAt: '2026-08-03T10:00:00-03:00',
            durationMinutes: 60,
            timezone: 'America/Sao_Paulo',
          },
          evidence: [{ topicId: 'topic-meeting', quote: 'Reunião do Projeto Aurora' }],
          confidence: { type: 100, project: 95, dates: 95 }, duplicateCandidates: [],
        },
        {
          id: 'task-1', topicIds: ['topic-meeting'], operation: 'CREATE', entity: 'TASK', dependsOn: [],
          data: { title: 'Revisar o acesso', project: { existingId: 'project-aurora' } },
          evidence: [{ topicId: 'topic-meeting', quote: 'revisar o acesso' }],
          confidence: { type: 95, project: 90 }, duplicateCandidates: [],
        },
        {
          id: 'task-2', topicIds: ['topic-meeting'], operation: 'CREATE', entity: 'TASK', dependsOn: [],
          data: { title: 'Publicar o relatório', project: { existingId: 'project-aurora' } },
          evidence: [{ topicId: 'topic-meeting', quote: 'publicar o relatório' }],
          confidence: { type: 95, project: 90, dates: 70 }, duplicateCandidates: [],
        },
      ],
      unresolved: [],
    }

    expect(harnessProposalV1Schema.parse(proposal).items).toHaveLength(3)
  })

  /**
   * Protege: entrada acima do orçamento é preservada e rejeitada inteira.
   * Detecta: truncamento silencioso antes do provedor.
   * Impacto: decisão ou tarefa pode desaparecer sem aviso.
   */
  it('H11 nunca trunca entrada grande', () => {
    const original = 'decisão importante '.repeat(100)
    const result = assessHarnessInput(original, {
      contextWindowTokens: 100,
      systemPromptTokens: 20,
      reservedOutputTokens: 20,
      reservedReferenceTokens: 10,
      safetyMarginTokens: 10,
      countTokens: (text) => text.split(/\s+/).filter(Boolean).length,
    })

    expect(result).toMatchObject({ accepted: false, code: 'INPUT_TOO_LARGE', original })
    expect(result.original).toBe(original)
  })

  /**
   * Protege: tópico ambíguo pode terminar sem entidade e com motivo explícito.
   * Detecta: schema obrigando item ou modelo inventando projeto/tarefa.
   * Impacto: informação falsa entra na revisão e pode ser aprovada.
   */
  it('H18 aceita UNRESOLVED sem forçar invenção', () => {
    const proposal = harnessProposalV1Schema.parse({
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      summary: 'Entrada ambígua mantida para revisão.',
      items: [],
      unresolved: [{
        topicId: 'topic-unknown',
        reason: 'Projeto e ação não identificados.',
        evidence: [{ quote: 'Talvez melhorar aquilo depois.' }],
      }],
    })

    expect(proposal.items).toEqual([])
    expect(proposal.unresolved).toHaveLength(1)
  })
})
