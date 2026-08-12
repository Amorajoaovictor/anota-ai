import { describe, expect, it } from 'vitest'
import { phase0EvalCorpus } from './fixtures/eval-corpus'

describe('Fase 0 — corpus inicial de eval', () => {
  /**
   * Protege: corpus mínimo cobre perda, ambiguidade, múltiplas entidades e ataques.
   * Detecta: mudança de prompt avaliada apenas com exemplos fáceis e felizes.
   * Impacto: regressão de segurança ou conteúdo chega à produção sem gate representativo.
   */
  it('possui IDs únicos e casos obrigatórios do plano', () => {
    const ids = phase0EvalCorpus.map((fixture) => fixture.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(phase0EvalCorpus.map((fixture) => fixture.category))).toEqual(new Set([
      'FACT_COVERAGE',
      'MULTI_ENTITY',
      'AMBIGUITY',
      'DUPLICATE',
      'PROMPT_INJECTION',
      'PRIVATE_NOTE_EXCLUSION',
      'LONG_INPUT',
      'REPETITIVE',
      'MULTI_PROJECT',
    ]))
    expect(phase0EvalCorpus.some((fixture) => fixture.input.source === 'STT')).toBe(true)
    expect(phase0EvalCorpus.find((fixture) => fixture.category === 'LONG_INPUT')?.input.content.length).toBeGreaterThan(5_000)
  })

  /**
   * Protege: fixture maliciosa exige rejeição de entidade proibida.
   * Detecta: eval de prompt injection sem resultado de segurança verificável.
   * Impacto: instrução externa pode tentar criar usuário, credencial ou permissão.
   */
  it('fixa USER como entidade proibida no caso de prompt injection', () => {
    const malicious = phase0EvalCorpus.find((fixture) => fixture.category === 'PROMPT_INJECTION')
    expect(malicious?.expectation.forbiddenEntities).toContain('USER')
    expect(malicious?.expectation.forbiddenFacts).toContain('Usuário administrador criado')
  })

  /**
   * Protege: nota privada existente nunca vira referência de IA.
   * Detecta: corpus sem fixture capaz de flagrar vazamento LGPD na recuperação futura.
   * Impacto: conteúdo pessoal pode sair no prompt do provedor.
   */
  it('marca nota privada como referência proibida', () => {
    const privateNote = phase0EvalCorpus.find((fixture) => fixture.category === 'PRIVATE_NOTE_EXCLUSION')
    expect(privateNote?.references?.some((reference) => reference.private)).toBe(true)
    expect(privateNote?.expectation.excludedReferenceIds).toContain('note-private-1')
  })
})
