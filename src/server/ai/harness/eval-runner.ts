import type { Phase0EvalFixture } from './fixtures/eval-corpus'

export type HarnessEvalFailure =
  | 'REQUIRED_FACT_MISSING'
  | 'FORBIDDEN_FACT_PRESENT'
  | 'REQUIRED_ENTITY_MISSING'
  | 'FORBIDDEN_ENTITY_PRESENT'
  | 'UNRESOLVED_COUNT_MISMATCH'
  | 'DUPLICATE_REFERENCE_MISSING'
  | 'EXCLUDED_REFERENCE_PRESENT'

export type HarnessEvalObservation = {
  markdown: string
  entityTypes: string[]
  unresolvedTopics: number
  duplicateReferenceIds: string[]
  retrievalReferenceIds: string[]
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
}

export type HarnessEvalCaseResult = {
  fixtureId: string
  passed: boolean
  failures: HarnessEvalFailure[]
  requiredFacts: number
  coveredFacts: number
  requiredEntities: number
  matchedEntities: number
}

/** Avalia somente resultados estruturados; conteúdo bruto não sai do processo de eval. */
export function evaluateHarnessFixture(
  fixture: Phase0EvalFixture,
  observation: HarnessEvalObservation,
): HarnessEvalCaseResult {
  const failures = new Set<HarnessEvalFailure>()
  const markdown = normalize(observation.markdown)
  const requiredFacts = fixture.expectation.requiredFacts ?? []
  const coveredFacts = requiredFacts.filter((fact) => markdown.includes(normalize(fact))).length
  if (coveredFacts !== requiredFacts.length) failures.add('REQUIRED_FACT_MISSING')
  if ((fixture.expectation.forbiddenFacts ?? []).some((fact) => markdown.includes(normalize(fact)))) {
    failures.add('FORBIDDEN_FACT_PRESENT')
  }

  const requiredEntities = fixture.expectation.requiredEntities ?? []
  const matchedEntities = multisetMatches(requiredEntities, observation.entityTypes)
  if (matchedEntities !== requiredEntities.length) failures.add('REQUIRED_ENTITY_MISSING')
  if ((fixture.expectation.forbiddenEntities ?? []).some((entity) => observation.entityTypes.includes(entity))) {
    failures.add('FORBIDDEN_ENTITY_PRESENT')
  }

  if (
    fixture.expectation.unresolvedTopics !== undefined
    && fixture.expectation.unresolvedTopics !== observation.unresolvedTopics
  ) failures.add('UNRESOLVED_COUNT_MISMATCH')
  if (!(fixture.expectation.duplicateReferenceIds ?? []).every((id) => observation.duplicateReferenceIds.includes(id))) {
    failures.add('DUPLICATE_REFERENCE_MISSING')
  }
  if ((fixture.expectation.excludedReferenceIds ?? []).some((id) => observation.retrievalReferenceIds.includes(id))) {
    failures.add('EXCLUDED_REFERENCE_PRESENT')
  }

  return {
    fixtureId: fixture.id,
    passed: failures.size === 0,
    failures: [...failures],
    requiredFacts: requiredFacts.length,
    coveredFacts,
    requiredEntities: requiredEntities.length,
    matchedEntities,
  }
}

export function evaluateHarnessCorpus(
  corpus: readonly Phase0EvalFixture[],
  observations: ReadonlyMap<string, HarnessEvalObservation>,
) {
  const missingFixtureIds = corpus.filter((fixture) => !observations.has(fixture.id)).map((fixture) => fixture.id)
  const cases = corpus.flatMap((fixture) => {
    const observation = observations.get(fixture.id)
    return observation ? [evaluateHarnessFixture(fixture, observation)] : []
  })
  const criticalFailureCount = cases.reduce((total, item) => total + item.failures.length, 0)
  const requiredFacts = cases.reduce((total, item) => total + item.requiredFacts, 0)
  const coveredFacts = cases.reduce((total, item) => total + item.coveredFacts, 0)
  const requiredEntities = cases.reduce((total, item) => total + item.requiredEntities, 0)
  const matchedEntities = cases.reduce((total, item) => total + item.matchedEntities, 0)

  return {
    promotable: missingFixtureIds.length === 0 && cases.every((item) => item.passed),
    missingFixtureIds,
    criticalFailureCount,
    factCoverage: ratio(coveredFacts, requiredFacts),
    entityRecall: ratio(matchedEntities, requiredEntities),
    cases,
  }
}

function multisetMatches(expected: readonly string[], actual: readonly string[]): number {
  const counts = new Map<string, number>()
  for (const item of actual) counts.set(item, (counts.get(item) ?? 0) + 1)
  let matches = 0
  for (const item of expected) {
    const remaining = counts.get(item) ?? 0
    if (remaining < 1) continue
    matches += 1
    counts.set(item, remaining - 1)
  }
  return matches
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/gu, ' ').trim()
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator
}
