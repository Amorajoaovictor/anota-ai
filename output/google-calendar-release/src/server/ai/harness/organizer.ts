import { assessHarnessInput } from './budget'
import { canonicalizeMarkdown, hashMarkdown } from './hash'

export type OrganizerInput = {
  transcript: string
  currentDate: string
  timezone: string
  promptVersion: string
}

export type OrganizerOutput = {
  markdown: string
  summary?: string
  topics: Array<{ id: string }>
}

export type HarnessOrganizerProvider = {
  organize(input: OrganizerInput, signal?: AbortSignal): Promise<OrganizerOutput>
}

export type OrganizerLimits = {
  contextWindowTokens: number
  systemPromptTokens: number
  reservedOutputTokens: number
  reservedReferenceTokens: number
  safetyMarginTokens: number
  maxMarkdownCharacters: number
  countTokens(content: string): number
}

export type OrganizeTranscriptResult =
  | {
    kind: 'organized'
    markdown: string
    markdownHash: string
    summary?: string
    topicIds: string[]
    inputMetrics: { bytes: number; characters: number; tokens: number }
  }
  | {
    kind: 'rejected'
    code: 'INPUT_TOO_LARGE'
    original: string
    inputMetrics: { bytes: number; characters: number; tokens: number; maximumInputTokens: number }
  }

/** Primeira chamada sem qualquer parametro de contexto de negocio. */
export async function organizeTranscript(
  input: OrganizerInput,
  limits: OrganizerLimits,
  provider: HarnessOrganizerProvider,
  signal?: AbortSignal,
): Promise<OrganizeTranscriptResult> {
  const assessment = assessHarnessInput(input.transcript, limits)
  const inputMetrics = {
    bytes: assessment.bytes,
    characters: assessment.characters,
    tokens: assessment.tokens,
  }
  if (!assessment.accepted) {
    return {
      kind: 'rejected',
      code: assessment.code,
      original: assessment.original,
      inputMetrics: { ...inputMetrics, maximumInputTokens: assessment.maximumInputTokens },
    }
  }

  const providerOutput = signal ? await provider.organize(input, signal) : await provider.organize(input)
  const output = validateOrganizedMarkdown(providerOutput, limits.maxMarkdownCharacters)
  return {
    kind: 'organized',
    markdown: output.markdown,
    markdownHash: hashMarkdown(output.markdown),
    summary: output.summary,
    topicIds: output.topics.map((topic) => topic.id),
    inputMetrics,
  }
}

export function validateOrganizedMarkdown(output: OrganizerOutput, maxMarkdownCharacters: number): OrganizerOutput {
  const markdown = canonicalizeMarkdown(output.markdown)
  if (!markdown.trim()) throw new Error('Markdown organizado nao pode ser vazio.')
  if (Array.from(markdown).length > maxMarkdownCharacters) throw new Error('Markdown organizado excede limite configurado.')
  if (/<\s*(script|iframe|object|embed|style|link|meta)\b|\bon\w+\s*=|javascript\s*:/i.test(markdown)) {
    throw new Error('Markdown organizado contem HTML perigoso.')
  }

  const topicIds = output.topics.map((topic) => topic.id.trim())
  if (topicIds.some((id) => !id)) throw new Error('ID de topico vazio.')
  if (new Set(topicIds).size !== topicIds.length) throw new Error('IDs de topico repetidos.')
  return { ...output, markdown, topics: topicIds.map((id) => ({ id })) }
}
