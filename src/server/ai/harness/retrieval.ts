import { createHash } from 'node:crypto'

export type RetrievalReferenceType = 'PROJECT' | 'ALIAS' | 'MODULE' | 'TAG' | 'TASK' | 'MILESTONE' | 'CONTEXT'
export type RetrievalSourceType = RetrievalReferenceType | 'NOTE'

export type RetrievalSource = {
  id: string
  ownerId: string
  kind: RetrievalSourceType
  projectId?: string
  title: string
  content?: string
  active?: boolean
  approved?: boolean
  private?: boolean
  discarded?: boolean
  updatedAt: string
}

export type RetrievalReference = {
  id: string
  type: RetrievalReferenceType
  projectId?: string
  version: string
  topicId: string
  title: string
  excerpt: string
  match: 'EXACT' | 'DUPLICATE_TITLE' | 'FULL_TEXT'
  score: number
  reason: string
}

export type RetrievalRequest = {
  ownerId: string
  topics: Array<{ id: string; text: string }>
  limits: { perTopic: number; perType: number }
}

export type RetrievalResult = { references: RetrievalReference[] }

export interface RetrievalProvider {
  retrieve(input: RetrievalRequest): Promise<RetrievalResult>
}

export type ReferenceOnlySnapshot = {
  marker: 'REFERENCE_ONLY'
  id: string
  aiRunId: string
  markdownRevisionId: string
  contentHash: string
  references: RetrievalReference[]
}

const EXACT_TYPES = new Set<RetrievalSourceType>(['PROJECT', 'ALIAS', 'MODULE', 'TAG'])
const FULL_TEXT_TYPES = new Set<RetrievalSourceType>(['TASK', 'MILESTONE', 'CONTEXT'])
const SECRET_PATTERN = /\b(?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*[^\s,;]+/giu

/** Fake determinístico do contrato. Espelha filtros obrigatórios antes do adapter PostgreSQL. */
export class InMemoryRetrievalProvider implements RetrievalProvider {
  constructor(private readonly sources: readonly RetrievalSource[]) {}

  async retrieve(input: RetrievalRequest): Promise<RetrievalResult> {
    assertLimit(input.limits.perTopic, 'perTopic')
    assertLimit(input.limits.perType, 'perType')
    const references: RetrievalReference[] = []

    for (const topic of input.topics) {
      const topicMatches = this.sources
        .filter((source) => source.ownerId === input.ownerId)
        .filter(isEligible)
        .map((source) => rankSource(topic, source))
        .filter((candidate): candidate is RetrievalReference => candidate !== null)
        .sort(compareReferences)

      const counts = new Map<RetrievalReferenceType, number>()
      for (const candidate of topicMatches) {
        if ((counts.get(candidate.type) ?? 0) >= input.limits.perType) continue
        if (references.filter((reference) => reference.topicId === topic.id).length >= input.limits.perTopic) break
        references.push(candidate)
        counts.set(candidate.type, (counts.get(candidate.type) ?? 0) + 1)
      }
    }

    return { references }
  }
}

export function createReferenceOnlySnapshot(
  aiRunId: string,
  markdownRevisionId: string,
  references: readonly RetrievalReference[],
): ReferenceOnlySnapshot {
  const sanitized = references.map((reference) => ({
    ...reference,
    title: sanitizeReferenceText(reference.title, 200),
    excerpt: sanitizeReferenceText(reference.excerpt, 1_000),
    reason: sanitizeReferenceText(reference.reason, 200),
  }))
  const serialized = stableStringify(sanitized)
  const contentHash = createHash('sha256').update(serialized, 'utf8').digest('hex')
  return {
    marker: 'REFERENCE_ONLY',
    id: `retrieval:${aiRunId}:${markdownRevisionId}:${contentHash.slice(0, 16)}`,
    aiRunId,
    markdownRevisionId,
    contentHash,
    references: sanitized,
  }
}

export function sanitizeReferenceText(value: string, maximumCharacters: number): string {
  if (!Number.isSafeInteger(maximumCharacters) || maximumCharacters < 1) throw new Error('Limite de referência inválido.')
  const sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .replace(SECRET_PATTERN, (match) => `${match.slice(0, match.search(/[:=]/u) + 1)}[REDACTED]`)
    .normalize('NFC')
  return Array.from(sanitized).slice(0, maximumCharacters).join('')
}

function isEligible(source: RetrievalSource): source is RetrievalSource & { kind: RetrievalReferenceType } {
  if (source.kind === 'NOTE' || source.private || source.discarded) return false
  if (source.kind === 'PROJECT' && source.active === false) return false
  if (source.kind === 'CONTEXT' && source.approved !== true) return false
  return true
}

function rankSource(topic: { id: string; text: string }, source: RetrievalSource & { kind: RetrievalReferenceType }): RetrievalReference | null {
  const normalizedTopic = normalizeSearchText(topic.text)
  const normalizedTitle = normalizeSearchText(source.title)
  const titleEqual = normalizedTopic === normalizedTitle
  const exact = EXACT_TYPES.has(source.kind) && titleEqual
  const duplicate = (source.kind === 'TASK' || source.kind === 'MILESTONE') && titleEqual
  const overlap = FULL_TEXT_TYPES.has(source.kind)
    ? tokenOverlap(normalizedTopic, normalizeSearchText(`${source.title} ${source.content ?? ''}`))
    : 0
  if (!exact && !duplicate && overlap === 0) return null

  const match = duplicate ? 'DUPLICATE_TITLE' : exact ? 'EXACT' : 'FULL_TEXT'
  const score = duplicate ? 300 : exact ? 250 : Math.min(200, 100 + overlap * 10)
  return {
    id: source.id,
    type: source.kind,
    ...(source.projectId ? { projectId: source.projectId } : {}),
    version: source.updatedAt,
    topicId: topic.id,
    title: sanitizeReferenceText(source.title, 200),
    excerpt: sanitizeReferenceText(source.content ? `${source.title}\n${source.content}` : source.title, 1_000),
    match,
    score,
    reason: match === 'FULL_TEXT' ? `full-text:${overlap}` : `${match.toLowerCase()}:title`,
  }
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function tokenOverlap(query: string, document: string): number {
  const documentTokens = new Set(document.split(' ').filter((token) => token.length > 2))
  return new Set(query.split(' ').filter((token) => token.length > 2 && documentTokens.has(token))).size
}

function compareReferences(left: RetrievalReference, right: RetrievalReference): number {
  return right.score - left.score
    || right.version.localeCompare(left.version)
    || left.type.localeCompare(right.type)
    || left.id.localeCompare(right.id)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function assertLimit(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Limite ${name} inválido.`)
}
