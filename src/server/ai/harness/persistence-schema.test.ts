import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../../../../prisma/schema.prisma', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../../../prisma/migrations/20260731120000_ai_harness_v2_persistence/migration.sql', import.meta.url), 'utf8')

describe('schema aditivo do harness v2', () => {
  /**
   * Protege: modelos v2 entram sem apagar contrato legado da inbox.
   * Detecta: migration destrutiva ou remoção prematura de suggestion/sourceInboxId.
   * Impacto: entradas antigas deixam de ser revisáveis ou rastreáveis.
   */
  it('preserva campos legados e não usa DROP na migration', () => {
    expect(schema).toContain('suggestion  Json?')
    expect(schema).toContain('sourceInboxId String?')
    expect(migration).not.toMatch(/\bDROP\b/i)
  })

  /**
   * Protege: revisões, aprovações, execução e origem possuem persistência própria.
   * Detecta: schema parcial incapaz de reproduzir aprovação ou deduplicar execução.
   * Impacto: fluxo não é auditável nem seguro para criação real.
   */
  it('declara modelos e constraints centrais da Fase 1', () => {
    for (const model of [
      'AiRun', 'TranscriptRevision', 'MarkdownRevision', 'RetrievalSnapshot',
      'ProposalRevision', 'ProposalItem', 'AiApproval', 'AiExecution',
      'EntityOrigin', 'AiCallAttempt', 'Meeting',
    ]) {
      expect(schema).toContain(`model ${model} {`)
    }
    expect(schema).toContain('@@unique([aiRunId, version])')
    expect(schema).toContain('idempotencyKey    String')
    expect(schema).toContain('@unique')
  })

  /**
   * Protege: exclusão da captura remove artefatos derivados sem afetar entidades legadas.
   * Detecta: falta de cascata nos artefatos internos do run.
   * Impacto: conteúdo derivado fica órfão após exclusão da entrada.
   */
  it('define cascata da inbox para AiRun e do run para revisões', () => {
    expect(schema).toMatch(/inboxItem\s+InboxItem\s+@relation\(fields: \[inboxItemId\], references: \[id\], onDelete: Cascade\)/)
    expect(schema).toMatch(/aiRun\s+AiRun\s+@relation\(fields: \[aiRunId\], references: \[id\], onDelete: Cascade\)/)
  })

  /**
   * Protege: a busca full-text obrigatória usa índices PostgreSQL nas três fontes textuais.
   * Detecta: migration funcional em testes unitários, mas que faz varredura completa em produção.
   * Impacto: fila cresce e a revisão de IA fica lenta conforme a base do usuário aumenta.
   */
  it('cria índices GIN para tasks, milestones e contexts', () => {
    expect(migration).toContain('"Task_harness_search_idx"')
    expect(migration).toContain('"Milestone_harness_search_idx"')
    expect(migration).toContain('"ProjectContext_harness_search_idx"')
    expect(migration.match(/USING GIN/g)).toHaveLength(3)
  })
})
