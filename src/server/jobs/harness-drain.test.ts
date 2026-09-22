import { describe, expect, it } from 'vitest'
import { shouldScheduleHarnessJobsDrain } from './harness-drain'

const enabled = {
  AI_HARNESS_V2_ENABLED: 'true',
  AI_HARNESS_V2_OWNER_IDS: 'owner-allowed',
}

describe('agendamento imediato do harness', () => {
  /**
   * Protege: worker local permanece dono da fila durante desenvolvimento.
   * Detecta: callback de produção concorrendo com npm run worker local.
   * Impacto: corrida local, testes instáveis e diagnóstico diferente da produção.
   */
  it('não agenda drain imediato fora da produção Vercel', () => {
    expect(shouldScheduleHarnessJobsDrain('owner-allowed', enabled)).toBe(false)
    expect(shouldScheduleHarnessJobsDrain('owner-allowed', { ...enabled, VERCEL_ENV: 'preview' })).toBe(false)
  })

  /**
   * Protege: apenas owner explicitamente habilitado ganha executor imediato.
   * Detecta: flag global liberando processamento de outra conta.
   * Impacto: execução e criação de entidades fora do rollout controlado.
   */
  it('agenda somente owner habilitado em produção', () => {
    const production = { ...enabled, VERCEL_ENV: 'production' }

    expect(shouldScheduleHarnessJobsDrain('owner-allowed', production)).toBe(true)
    expect(shouldScheduleHarnessJobsDrain('owner-other', production)).toBe(false)
  })
})
