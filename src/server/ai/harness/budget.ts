import { z } from 'zod'

export const HARNESS_LIMITS_SCHEMA_VERSION = 1 as const

export const harnessModelLimitsV1Schema = z.object({
  schemaVersion: z.literal(HARNESS_LIMITS_SCHEMA_VERSION),
  model: z.string().trim().min(1),
  contextWindowTokens: z.number().int().positive(),
  systemPromptTokens: z.number().int().nonnegative(),
  reservedOutputTokens: z.number().int().nonnegative(),
  reservedReferenceTokens: z.number().int().nonnegative(),
  safetyMarginTokens: z.number().int().nonnegative(),
  maxUploadBytes: z.number().int().positive(),
  maxAudioDurationMs: z.number().int().positive(),
  maxMarkdownCharacters: z.number().int().positive(),
  maxProposalItems: z.literal(100),
}).strict()

export type HarnessModelLimitsV1 = z.infer<typeof harnessModelLimitsV1Schema>

type BudgetAssessmentInput = Pick<
  HarnessModelLimitsV1,
  | 'contextWindowTokens'
  | 'systemPromptTokens'
  | 'reservedOutputTokens'
  | 'reservedReferenceTokens'
  | 'safetyMarginTokens'
> & {
  countTokens(content: string): number
}

export type HarnessInputAssessment = {
  original: string
  bytes: number
  characters: number
  tokens: number
  maximumInputTokens: number
} & (
  | { accepted: true }
  | { accepted: false; code: 'INPUT_TOO_LARGE' }
)

export function calculateMaximumInputTokens(input: Omit<BudgetAssessmentInput, 'countTokens'>): number {
  const reserved = input.systemPromptTokens
    + input.reservedOutputTokens
    + input.reservedReferenceTokens
    + input.safetyMarginTokens
  const maximum = input.contextWindowTokens - reserved
  if (maximum < 1) throw new Error('Orçamento do harness não deixa tokens disponíveis para entrada.')
  return maximum
}

/** Mede conteúdo inteiro. Nunca recorta texto para fazê-lo caber. */
export function assessHarnessInput(original: string, input: BudgetAssessmentInput): HarnessInputAssessment {
  const maximumInputTokens = calculateMaximumInputTokens(input)
  const tokens = input.countTokens(original)
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Contador de tokens retornou valor inválido.')

  const metrics = {
    original,
    bytes: Buffer.byteLength(original, 'utf8'),
    characters: Array.from(original).length,
    tokens,
    maximumInputTokens,
  }
  return tokens <= maximumInputTokens
    ? { ...metrics, accepted: true }
    : { ...metrics, accepted: false, code: 'INPUT_TOO_LARGE' }
}
