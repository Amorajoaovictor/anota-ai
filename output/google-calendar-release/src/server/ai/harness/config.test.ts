import { describe, expect, it } from 'vitest'
import { isHarnessEnabledForOwner, readHarnessV2Config, toPublicHarnessConfig } from './config'

describe('configuração do harness v2', () => {
  /**
   * Protege: fluxo v2 nasce desligado e exige ativação explícita.
   * Detecta: ausência ou valor parecido com true habilitando feature incompleta.
   * Impacto: usuário pode entrar em fluxo ainda sem rollout aprovado.
   */
  it('mantém feature flag desligada por padrão', () => {
    expect(readHarnessV2Config({}).enabled).toBe(false)
    expect(readHarnessV2Config({ AI_HARNESS_V2_ENABLED: '1' }).enabled).toBe(false)
  })

  /**
   * Protege: ativação possui valor explícito e limites centralizados.
   * Detecta: configuração dispersa ou flag impossível de habilitar no rollout.
   * Impacto: operação insegura ou rollout bloqueado.
   */
  it('habilita somente com true e valida limites', () => {
    const config = readHarnessV2Config({
      AI_HARNESS_V2_ENABLED: 'true',
      AI_HARNESS_MAX_PROPOSAL_ITEMS: '100',
      AI_HARNESS_MAX_MARKDOWN_CHARACTERS: '50000',
    })

    expect(config).toMatchObject({ enabled: true, maxProposalItems: 100, maxMarkdownCharacters: 50_000 })
    expect(() => readHarnessV2Config({ AI_HARNESS_MAX_PROPOSAL_ITEMS: '101' })).toThrow('AI_HARNESS_MAX_PROPOSAL_ITEMS')
  })

  /**
   * Protege: master switch + allowlist habilitam somente owners escolhidos no rollout.
   * Detecta: flag global ignorando allowlist ou allowlist furando master switch desligado.
   * Impacto: conta nao aprovada entra no fluxo novo com dados reais.
   */
  it('aplica allowlist por owner sem habilitar conta fora do rollout', () => {
    const config = readHarnessV2Config({
      AI_HARNESS_V2_ENABLED: 'true',
      AI_HARNESS_V2_OWNER_IDS: ' owner-1,owner-2,owner-1 ',
    })

    expect(config.ownerAllowlist).toEqual(['owner-1', 'owner-2'])
    expect(isHarnessEnabledForOwner(config, 'owner-1')).toBe(true)
    expect(isHarnessEnabledForOwner(config, 'owner-3')).toBe(false)
    expect(isHarnessEnabledForOwner(readHarnessV2Config({ AI_HARNESS_V2_OWNER_IDS: 'owner-1' }), 'owner-1')).toBe(false)
    expect(isHarnessEnabledForOwner(readHarnessV2Config({ AI_HARNESS_V2_ENABLED: 'true' }), 'qualquer-owner')).toBe(false)
  })

  /**
   * Protege: limites, timeouts, token budgets e alertas saem de uma configuracao validada.
   * Detecta: valor negativo/zero ou timeout divergente hardcoded em worker.
   * Impacto: custo sem limite, abort precoce ou job preso por horas.
   */
  it('centraliza configuracao operacional e rejeita valores invalidos', () => {
    const config = readHarnessV2Config({
      AI_HARNESS_MAX_AUDIO_BYTES: '2048',
      AI_HARNESS_TRANSCRIPTION_TIMEOUT_MS: '120000',
      AI_HARNESS_ORGANIZATION_TIMEOUT_MS: '45000',
      AI_HARNESS_ORGANIZER_CONTEXT_TOKENS: '32000',
      AI_HARNESS_ORGANIZER_OUTPUT_TOKENS: '4000',
      AI_HARNESS_ALERT_BACKLOG: '20',
      AI_HARNESS_ALERT_OLDEST_JOB_MS: '90000',
    })

    expect(config).toMatchObject({
      maxAudioBytes: 2048,
      timeouts: { transcriptionMs: 120000, organizationMs: 45000 },
      organizerBudget: { contextWindowTokens: 32000, reservedOutputTokens: 4000 },
      alerts: { backlog: 20, oldestJobAgeMs: 90000 },
    })
    expect(() => readHarnessV2Config({ AI_HARNESS_TRANSCRIPTION_TIMEOUT_MS: '0' })).toThrow('AI_HARNESS_TRANSCRIPTION_TIMEOUT_MS')
  })

  /**
   * Protege: resposta operacional publica somente numeros e estado, nunca allowlist/config sensivel.
   * Detecta: endpoint serializando config interna inteira.
   * Impacto: IDs de contas e estrategia de rollout ficam expostos.
   */
  it('remove allowlist da configuracao publica', () => {
    const config = readHarnessV2Config({
      AI_HARNESS_V2_ENABLED: 'true',
      AI_HARNESS_V2_OWNER_IDS: 'owner-secreto',
    })

    const publicConfig = toPublicHarnessConfig(config)

    expect(publicConfig).toMatchObject({ enabledForRequestOwner: false })
    expect(JSON.stringify(publicConfig)).not.toContain('owner-secreto')
    expect(JSON.stringify(publicConfig)).not.toContain('ownerAllowlist')
  })
})
