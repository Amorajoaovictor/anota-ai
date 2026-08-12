export type HarnessTokenBudget = {
  contextWindowTokens: number
  systemPromptTokens: number
  reservedOutputTokens: number
  reservedReferenceTokens: number
  safetyMarginTokens: number
}

export type HarnessV2Config = {
  enabled: boolean
  ownerAllowlist: string[]
  maxProposalItems: number
  maxMarkdownCharacters: number
  maxAudioBytes: number
  timeouts: {
    transcriptionMs: number
    organizationMs: number
    retrievalMs: number
    materializationMs: number
    cleanupMs: number
  }
  organizerBudget: HarnessTokenBudget
  materializerBudget: HarnessTokenBudget
  alerts: {
    backlog: number
    oldestJobAgeMs: number
    noActiveWorkerGraceMs: number
  }
}

export function readHarnessV2Config(environment: Record<string, string | undefined>): HarnessV2Config {
  const config: HarnessV2Config = {
    enabled: environment.AI_HARNESS_V2_ENABLED?.trim() === 'true',
    ownerAllowlist: readOwnerAllowlist(environment.AI_HARNESS_V2_OWNER_IDS),
    maxProposalItems: readPositiveInteger(environment, 'AI_HARNESS_MAX_PROPOSAL_ITEMS', 100, 100),
    maxMarkdownCharacters: readPositiveInteger(environment, 'AI_HARNESS_MAX_MARKDOWN_CHARACTERS', 50_000, 1_000_000),
    maxAudioBytes: readPositiveInteger(environment, 'AI_HARNESS_MAX_AUDIO_BYTES', 25 * 1024 * 1024, 500 * 1024 * 1024),
    timeouts: {
      transcriptionMs: readPositiveInteger(environment, 'AI_HARNESS_TRANSCRIPTION_TIMEOUT_MS', 5 * 60_000, 30 * 60_000),
      organizationMs: readPositiveInteger(environment, 'AI_HARNESS_ORGANIZATION_TIMEOUT_MS', 60_000, 30 * 60_000),
      retrievalMs: readPositiveInteger(environment, 'AI_HARNESS_RETRIEVAL_TIMEOUT_MS', 30_000, 30 * 60_000),
      materializationMs: readPositiveInteger(environment, 'AI_HARNESS_MATERIALIZATION_TIMEOUT_MS', 90_000, 30 * 60_000),
      cleanupMs: readPositiveInteger(environment, 'AI_HARNESS_CLEANUP_TIMEOUT_MS', 30_000, 30 * 60_000),
    },
    organizerBudget: {
      contextWindowTokens: readPositiveInteger(environment, 'AI_HARNESS_ORGANIZER_CONTEXT_TOKENS', 64_000, 2_000_000),
      systemPromptTokens: readNonNegativeInteger(environment, 'AI_HARNESS_ORGANIZER_SYSTEM_TOKENS', 2_000, 2_000_000),
      reservedOutputTokens: readPositiveInteger(environment, 'AI_HARNESS_ORGANIZER_OUTPUT_TOKENS', 8_000, 2_000_000),
      reservedReferenceTokens: 0,
      safetyMarginTokens: readNonNegativeInteger(environment, 'AI_HARNESS_ORGANIZER_SAFETY_TOKENS', 2_000, 2_000_000),
    },
    materializerBudget: {
      contextWindowTokens: readPositiveInteger(environment, 'AI_HARNESS_MATERIALIZER_CONTEXT_TOKENS', 64_000, 2_000_000),
      systemPromptTokens: readNonNegativeInteger(environment, 'AI_HARNESS_MATERIALIZER_SYSTEM_TOKENS', 3_000, 2_000_000),
      reservedOutputTokens: readPositiveInteger(environment, 'AI_HARNESS_MATERIALIZER_OUTPUT_TOKENS', 8_000, 2_000_000),
      reservedReferenceTokens: readNonNegativeInteger(environment, 'AI_HARNESS_MATERIALIZER_REFERENCE_TOKENS', 8_000, 2_000_000),
      safetyMarginTokens: readNonNegativeInteger(environment, 'AI_HARNESS_MATERIALIZER_SAFETY_TOKENS', 2_000, 2_000_000),
    },
    alerts: {
      backlog: readPositiveInteger(environment, 'AI_HARNESS_ALERT_BACKLOG', 50, 1_000_000),
      oldestJobAgeMs: readPositiveInteger(environment, 'AI_HARNESS_ALERT_OLDEST_JOB_MS', 5 * 60_000, 7 * 24 * 60 * 60_000),
      noActiveWorkerGraceMs: readPositiveInteger(environment, 'AI_HARNESS_ALERT_NO_WORKER_GRACE_MS', 60_000, 24 * 60 * 60_000),
    },
  }
  assertTokenBudget('AI_HARNESS_ORGANIZER', config.organizerBudget)
  assertTokenBudget('AI_HARNESS_MATERIALIZER', config.materializerBudget)
  return config
}

export function isHarnessEnabledForOwner(config: HarnessV2Config, ownerId: string): boolean {
  if (!config.enabled) return false
  return config.ownerAllowlist.includes(ownerId)
}

export function toPublicHarnessConfig(config: HarnessV2Config, ownerId?: string) {
  return {
    enabledForRequestOwner: ownerId ? isHarnessEnabledForOwner(config, ownerId) : false,
    limits: {
      maxProposalItems: config.maxProposalItems,
      maxMarkdownCharacters: config.maxMarkdownCharacters,
      maxAudioBytes: config.maxAudioBytes,
    },
    timeouts: config.timeouts,
    alerts: config.alerts,
  }
}

function readOwnerAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  const owners = [...new Set(raw.split(',').map((ownerId) => ownerId.trim()).filter(Boolean))]
  if (owners.length > 1_000 || owners.some((ownerId) => ownerId.length > 200)) {
    throw new Error('AI_HARNESS_V2_OWNER_IDS excede limite permitido.')
  }
  return owners
}

function assertTokenBudget(name: string, budget: HarnessTokenBudget) {
  const reserved = budget.systemPromptTokens
    + budget.reservedOutputTokens
    + budget.reservedReferenceTokens
    + budget.safetyMarginTokens
  if (reserved >= budget.contextWindowTokens) {
    throw new Error(`${name} possui reservas maiores ou iguais ao contexto.`)
  }
}

function readPositiveInteger(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const raw = environment[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} deve ser inteiro entre 1 e ${maximum}.`)
  }
  return value
}

function readNonNegativeInteger(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
  maximum: number,
) {
  const raw = environment[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${name} deve ser inteiro entre 0 e ${maximum}.`)
  }
  return value
}
