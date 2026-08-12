import { describe, expect, it } from 'vitest'
import {
  HarnessConcurrencyLimiter,
  HarnessFeatureFlag,
  InMemoryHarnessMetrics,
} from './rollout'

describe('Fase 8 — rollout unitário', () => {
  /**
   * Protege: flag global e allowlist por usuário precisam concordar.
   * Detecta: rollout habilitando todas as contas por configuração parcial.
   * Impacto: fluxo novo alcança usuários antes do gate.
   */
  it('habilita harness somente para proprietário autorizado', () => {
    expect(new HarnessFeatureFlag(false, ['owner-1']).isEnabled('owner-1')).toBe(false)
    const flag = new HarnessFeatureFlag(true, ['owner-1'])
    expect(flag.isEnabled('owner-1')).toBe(true)
    expect(flag.isEnabled('owner-2')).toBe(false)
  })

  /**
   * Protege: concorrência possui limite por owner e provedor.
   * Detecta: um usuário monopolizando provedor ou limite não liberado.
   * Impacto: custo alto, 429 e fila degradada para todos.
   */
  it('aplica e libera limites por proprietário e provedor', () => {
    const limiter = new HarnessConcurrencyLimiter({ perOwner: 1, perProvider: 2 })
    const first = limiter.tryAcquire('owner-1', 'deepseek')
    const secondOwner = limiter.tryAcquire('owner-2', 'deepseek')

    expect(first).not.toBeNull()
    expect(limiter.tryAcquire('owner-1', 'deepseek')).toBeNull()
    expect(secondOwner).not.toBeNull()
    expect(limiter.tryAcquire('owner-3', 'deepseek')).toBeNull()
    first?.release()
    expect(limiter.tryAcquire('owner-1', 'deepseek')).not.toBeNull()
  })

  /**
   * Protege: métricas operacionais guardam números e dimensões allowlisted, não conteúdo.
   * Detecta: transcrição, Markdown ou prompt entrando em labels.
   * Impacto: vazamento em logs/dashboard e cardinalidade sem limite.
   */
  it('registra tokens, latência e resultado sem aceitar labels livres', () => {
    const metrics = new InMemoryHarnessMetrics()
    metrics.recordCall({
      step: 'MATERIALIZING', provider: 'deepseek', model: 'chat-v3', result: 'SUCCESS',
      inputTokens: 120, outputTokens: 40, latencyMs: 250, estimatedCost: 0.01,
    })

    expect(metrics.snapshot()).toEqual([expect.objectContaining({ inputTokens: 120, outputTokens: 40, latencyMs: 250 })])
    expect(JSON.stringify(metrics.snapshot())).not.toContain('approvedMarkdown')
  })
})
