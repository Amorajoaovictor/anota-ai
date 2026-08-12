import { describe, expect, it } from 'vitest'
import { HARNESS_PROPOSAL_SCHEMA_VERSION, harnessProposalV1Schema } from './contracts'
import { canTransitionHarnessRun } from './state-machine'

const validTask = (id: string) => ({
  id,
  topicIds: ['topic-1'],
  operation: 'CREATE',
  entity: 'TASK',
  dependsOn: [],
  data: { title: `Tarefa ${id}`, project: { existingId: 'project-1' } },
  evidence: [{ topicId: 'topic-1', quote: `Tarefa ${id}` }],
  confidence: { type: 90, project: 90 },
  duplicateCandidates: [],
})

describe('Fase 0 — schemas e máquina de estados', () => {
  /**
   * Protege: caminho normal, descarte e estados terminais seguem contrato único.
   * Detecta: etapa pulada ou run terminal reaberto por código novo.
   * Impacto: aprovação pode ser contornada ou processamento duplicado.
   */
  it('aceita apenas transições declaradas no plano', () => {
    expect(canTransitionHarnessRun('RECEIVED', 'TRANSCRIBED')).toBe(true)
    expect(canTransitionHarnessRun('RECEIVED', 'TRANSCRIBING')).toBe(true)
    expect(canTransitionHarnessRun('TRANSCRIBED', 'AWAITING_MARKDOWN_APPROVAL')).toBe(false)
    expect(canTransitionHarnessRun('MATERIALIZING', 'DISCARDED')).toBe(true)
    expect(canTransitionHarnessRun('PROCESSED', 'DISCARDED')).toBe(false)
    expect(canTransitionHarnessRun('DISCARDED', 'RECEIVED')).toBe(false)
  })

  /**
   * Protege: proposta tem versão, allowlist, limite e estrutura strict.
   * Detecta: payload arbitrário, entidade proibida ou mais de 100 ações.
   * Impacto: executor recebe operação não auditada ou proposta inviável de revisar.
   */
  it('rejeita entidade fora da allowlist, campos desconhecidos e mais de 100 itens', () => {
    const base = { schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION, summary: 'Teste', unresolved: [] }
    expect(harnessProposalV1Schema.safeParse({ ...base, items: [{ ...validTask('task-1'), entity: 'USER' }] }).success).toBe(false)
    expect(harnessProposalV1Schema.safeParse({ ...base, items: [validTask('task-1')], ownerId: 'não-aceitar' }).success).toBe(false)
    expect(harnessProposalV1Schema.safeParse({ ...base, items: Array.from({ length: 101 }, (_, index) => validTask(`task-${index}`)) }).success).toBe(false)
  })

  /**
   * Protege: nota criada pelo harness sempre nasce privada.
   * Detecta: proposta tentando expor nota para IA/MCP por padrão.
   * Impacto: vazamento de conteúdo pessoal e risco LGPD.
   */
  it('rejeita NOTE com private diferente de true', () => {
    const result = harnessProposalV1Schema.safeParse({
      schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION,
      summary: 'Nota proposta.',
      items: [{
        id: 'note-1', topicIds: ['topic-1'], operation: 'CREATE', entity: 'NOTE', dependsOn: [],
        data: { title: 'Nota', content: 'Conteúdo', project: { existingId: 'project-1' }, private: false },
        evidence: [{ topicId: 'topic-1', quote: 'Conteúdo' }],
        confidence: { type: 90, project: 90 }, duplicateCandidates: [],
      }],
      unresolved: [],
    })

    expect(result.success).toBe(false)
  })

  /**
   * Protege: dependências locais são existentes e acíclicas.
   * Detecta: grafo impossível chegando ao preview/executor.
   * Impacto: criação parcial ou proposta impossível de executar.
   */
  it('rejeita dependência inexistente e ciclo', () => {
    const base = { schemaVersion: HARNESS_PROPOSAL_SCHEMA_VERSION, summary: 'Grafo', unresolved: [] }
    expect(harnessProposalV1Schema.safeParse({
      ...base,
      items: [{ ...validTask('task-1'), dependsOn: ['task-ausente'] }],
    }).success).toBe(false)
    expect(harnessProposalV1Schema.safeParse({
      ...base,
      items: [
        { ...validTask('task-1'), dependsOn: ['task-2'] },
        { ...validTask('task-2'), dependsOn: ['task-1'] },
      ],
    }).success).toBe(false)
  })
})
